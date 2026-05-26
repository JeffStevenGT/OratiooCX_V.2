-- ═══════════════════════════════════════════════════════════════
-- ORATIOO CX - 50 leads de prueba para testear asignaciones
-- ═══════════════════════════════════════════════════════════════
-- EJECUTAR EN: Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Función auxiliar para generar DNIs aleatorios
CREATE OR REPLACE FUNCTION random_dni() RETURNS TEXT AS $$
DECLARE
  nums TEXT;
BEGIN
  nums := '';
  FOR i IN 1..8 LOOP
    nums := nums || floor(random() * 10)::TEXT;
  END LOOP;
  -- Añadir letra de control
  nums := nums || chr(65 + floor(random() * 26)::INT);
  RETURN nums;
END;
$$ LANGUAGE plpgsql;

-- Función para generar nombre aleatorio
CREATE OR REPLACE FUNCTION random_name() RETURNS TEXT AS $$
DECLARE
  nombres TEXT[] := ARRAY[
    'Carlos', 'Maria', 'Jose', 'Ana', 'Luis', 'Carmen', 'Miguel', 'Rosa',
    'Javier', 'Isabel', 'Pedro', 'Sofia', 'Angel', 'Laura', 'David', 'Elena',
    'Antonio', 'Marta', 'Manuel', 'Cristina', 'Ricardo', 'Claudia', 'Fernando', 'Patricia',
    'Alberto', 'Diana', 'Rafael', 'Silvia', 'Pablo', 'Veronica', 'Sergio', 'Monica',
    'Enrique', 'Raquel', 'Diego', 'Natalia', 'Ivan', 'Andrea', 'Juan', 'Paula'
  ];
  apellidos TEXT[] := ARRAY[
    'Garcia', 'Lopez', 'Martinez', 'Rodriguez', 'Fernandez', 'Gonzalez', 'Perez', 'Sanchez',
    'Ramirez', 'Torres', 'Flores', 'Rivera', 'Gomez', 'Diaz', 'Moreno', 'Jimenez',
    'Ruiz', 'Alvarez', 'Romero', 'Navarro', 'Castro', 'Ortega', 'Delgado', 'Molina',
    'Ortiz', 'Marin', 'Morales', 'Suarez', 'Iglesias', 'Cruz', 'Reyes', 'Vega',
    'Campos', 'Nunez', 'Vargas', 'Herrera', 'Castillo', 'Santiago', 'Garrido', 'Pena'
  ];
BEGIN
  RETURN nombres[1 + floor(random() * array_length(nombres, 1))::INT]
    || ' ' ||
    apellidos[1 + floor(random() * array_length(apellidos, 1))::INT]
    || ' ' ||
    apellidos[1 + floor(random() * array_length(apellidos, 1))::INT];
END;
$$ LANGUAGE plpgsql;

-- Función para generar dirección aleatoria
CREATE OR REPLACE FUNCTION random_direccion() RETURNS TEXT AS $$
DECLARE
  calles TEXT[] := ARRAY[
    'Calle Mayor', 'Avenida de la Constitucion', 'Calle Gran Via', 'Paseo del Prado',
    'Calle Serrano', 'Avenida Diagonal', 'Calle Alcala', 'Rambla de Catalunya',
    'Calle de la Paz', 'Avenida de America', 'Calle Velazquez', 'Paseo de la Castellana',
    'Calle San Sebastian', 'Avenida del Mediterraneo', 'Calle Real', 'Plaza Mayor',
    'Calle del Sol', 'Avenida de Andalucia', 'Calle Nueva', 'Paseo Maritimo'
  ];
  ciudades TEXT[] := ARRAY[
    'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Malaga', 'Zaragoza',
    'Murcia', 'Palma', 'Alicante', 'Lima', 'Arequipa', 'Cusco', 'Trujillo',
    'Chiclayo', 'Piura', 'Iquitos', 'Huancayo', 'Tacna', 'Puno'
  ];
BEGIN
  RETURN calles[1 + floor(random() * array_length(calles, 1))::INT]
    || ', ' || (floor(random() * 200 + 1)::INT)::TEXT
    || ', ' || ciudades[1 + floor(random() * array_length(ciudades, 1))::INT];
END;
$$ LANGUAGE plpgsql;

-- Función para generar teléfono
CREATE OR REPLACE FUNCTION random_telefono() RETURNS TEXT AS $$
DECLARE
  nums TEXT;
BEGIN
  nums := '6';
  FOR i IN 1..8 LOOP
    nums := nums || floor(random() * 10)::TEXT;
  END LOOP;
  RETURN nums;
END;
$$ LANGUAGE plpgsql;

-- Función para escoger aleatoriamente un valor de un array
CREATE OR REPLACE FUNCTION random_from(arr TEXT[]) RETURNS TEXT AS $$
BEGIN
  RETURN arr[1 + floor(random() * array_length(arr, 1))::INT];
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- INSERTAR 50 LEADS DE PRUEBA
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  i INT;
  v_dni TEXT;
  v_nombre TEXT;
  v_direccion TEXT;
  v_linea TEXT;
  v_paquete TEXT;
  v_cima TEXT;
  v_renove TEXT;
  v_variante TEXT;
  v_estado TEXT;
  v_atributos JSONB;
BEGIN
  FOR i IN 1..50 LOOP
    v_dni := random_dni();
    v_nombre := random_name();
    v_direccion := random_direccion();
    v_linea := random_telefono();
    v_paquete := random_from(ARRAY['Fibra 300Mb + Movil', 'Fibra 600Mb + Movil Ilimitado', 'Fibra 1Gb + Movil Max', 'Solo Fibra 300Mb', 'Movil Ilimitado 50Gb', 'Movil Ilimitado 100Gb', 'Duo Fibra 300Mb + Movil', 'Duo Fibra 600Mb + 2 Moviles']);
    v_cima := CASE WHEN random() < 0.35 THEN 'SI' ELSE 'NO' END;
    v_renove := CASE WHEN random() < 0.4 THEN 'SI' ELSE 'NO' END;

    IF v_renove = 'SI' THEN
      v_variante := random_from(ARRAY[
        'Renove mixto al mejor precio con maximo descuento',
        'Renove mixto al mejor precio con descuento',
        'Renove mixto al mejor precio',
        'Renove mixto',
        'Renove Multidispositivo',
        'Renove pago unico'
      ]);
    ELSE
      v_variante := 'N/A';
    END IF;

    v_estado := random_from(ARRAY['completado', 'completado', 'completado', 'no_cliente', 'completado']);

    -- Construir JSONB
    v_atributos := jsonb_build_object(
      'cima', v_cima,
      'tiene_renove_mixto', CASE WHEN v_renove = 'SI' AND v_variante LIKE 'Renove mixto%' THEN true ELSE false END,
      'renove_mixto_variante', CASE WHEN v_renove = 'SI' AND v_variante LIKE 'Renove mixto%' THEN v_variante ELSE 'N/A' END,
      'estado', v_estado,
      'datos_basicos', jsonb_build_object(
        'nombre', v_nombre,
        'direccion', v_direccion
      ),
      'linea', jsonb_build_object(
        'numero', v_linea,
        'paquete', v_paquete
      ),
      'pestanas', jsonb_build_object(
        'Destacadas', CASE WHEN random() < 0.7 THEN random_from(ARRAY['Oferta Fibra 300Mb 29.90€', 'Pack deportes 9.99€', 'Cambio a Fusion 49.90€', 'Mantenimiento incluido', '2 meses gratis Netflix']) ELSE 'N/A' END,
        'Renove', CASE WHEN v_renove = 'SI' THEN random_from(ARRAY['Renove con 50% descuento 6 meses', 'Renove sin permanencia', 'Mejora equipo gratis', 'Renove + Netflix incluido']) ELSE 'N/A' END,
        'Bonos y D.', CASE WHEN random() < 0.5 THEN random_from(ARRAY['Bono 10€ 3 meses', 'Dto 20% factura', 'Bono datos 50GB gratis']) ELSE 'N/A' END,
        'Cambio Tarifa', CASE WHEN random() < 0.3 THEN random_from(ARRAY['Subir a 1Gb por +5€', 'Bajar a 300Mb -10€', 'Misma tarifa mejor precio']) ELSE 'N/A' END,
        'SVA', CASE WHEN random() < 0.4 THEN random_from(ARRAY['Seguro movil 3.99€', 'McAfee 1.99€', 'Cloud 100GB 0.99€']) ELSE 'N/A' END
      ),
      'pipeline', jsonb_build_object(
        'estado', 'pendiente',
        'asesor_id', null,
        'notas', ''
      )
    );

    INSERT INTO lineas (dni, nombre, direccion, linea, paquete, atributos_dinamicos)
    VALUES (v_dni, v_nombre, v_direccion, v_linea, v_paquete, v_atributos);

  END LOOP;
END $$;

-- Verificar
SELECT COUNT(*) AS total_leads FROM lineas;
