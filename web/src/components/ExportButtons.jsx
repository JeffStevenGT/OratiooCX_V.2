import { useState } from 'react'
import { Download, FileSpreadsheet, FileJson, Loader2 } from 'lucide-react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

export default function ExportButtons({ data = [] }) {
  const [exporting, setExporting] = useState(null)

  const exportExcel = async () => {
    setExporting('excel')
    try {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Clientes')

      sheet.columns = [
        { header: 'DNI', key: 'dni', width: 15 },
        { header: 'Nombre', key: 'nombre', width: 30 },
        { header: 'Dirección', key: 'direccion', width: 35 },
        { header: 'Línea Principal', key: 'linea_principal', width: 18 },
        { header: 'Paquete', key: 'paquete', width: 22 },
        { header: 'CIMA', key: 'cima', width: 8 },
        { header: 'Renove Mixto', key: 'renove', width: 13 },
        { header: 'Variante Renove', key: 'variante', width: 35 },
        { header: 'Tags', key: 'tags', width: 25 },
        { header: 'Estado', key: 'estado', width: 14 },
        { header: 'Fecha Extracción', key: 'fecha', width: 14 },
        { header: 'Seg. Fijo', key: 'seg_fijo', width: 14 },
        { header: 'Seg. Móvil', key: 'seg_movil', width: 14 },
        { header: 'Destacadas', key: 'destacadas', width: 30 },
        { header: 'Renove (tab)', key: 'renove_tab', width: 30 },
        { header: 'Bonos y D.', key: 'bonos', width: 30 },
        { header: 'Cambio Tarifa', key: 'cambio', width: 30 },
        { header: 'SVA', key: 'sva', width: 30 },
      ]

      const rows = data.map((c) => {
        const attr = c.atributos_dinamicos || {}
        const bas = attr.datos_basicos || {}
        const linea = attr.linea || {}
        const pestanas = attr.pestanas || {}
        return {
          dni: c.dni || '',
          nombre: bas.nombre || '',
          direccion: bas.direccion || '',
          linea_principal: linea.linea_principal || c.linea || '',
          paquete: linea.paquete || c.paquete || '',
          cima: attr.cima || 'NO',
          renove: attr.tiene_renove_mixto ? 'SÍ' : 'NO',
          variante: attr.renove_mixto_variante || 'N/A',
          tags: attr.cima_tags || 'N/A',
          estado: attr.estado || 'N/A',
          fecha: c.created_at ? new Date(c.created_at).toLocaleDateString('es') : '',
          seg_fijo: bas.seg_fijo || c.seg_fijo || '',
          seg_movil: bas.seg_movil || c.seg_movil || '',
          destacadas: pestanas.Destacadas || 'N/A',
          renove_tab: pestanas.Renove || 'N/A',
          bonos: pestanas['Bonos y D.'] || 'N/A',
          cambio: pestanas['Cambio Tarifa'] || 'N/A',
          sva: pestanas.SVA || 'N/A',
        }
      })

      rows.forEach((r) => sheet.addRow(r))

      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const today = new Date().toISOString().split('T')[0]
      saveAs(blob, `ORATIOO_CX_${today}.xlsx`)
    } catch (err) {
      console.error('Error exporting Excel:', err)
    } finally {
      setExporting(null)
    }
  }

  const exportJSON = () => {
    const clean = data.map((c) => {
      const attr = c.atributos_dinamicos || {}
      const bas = attr.datos_basicos || {}
      const linea = attr.linea || {}
      return {
        dni: c.dni,
        nombre: bas.nombre,
        direccion: bas.direccion,
        linea_principal: linea.linea_principal || c.linea,
        paquete: linea.paquete || c.paquete,
        cima: attr.cima,
        renove_mixto: attr.tiene_renove_mixto,
        variante_renove: attr.renove_mixto_variante,
        tags: attr.cima_tags,
        estado: attr.estado,
        fecha: c.created_at,
      }
    })
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' })
    const today = new Date().toISOString().split('T')[0]
    saveAs(blob, `ORATIOO_CX_${today}.json`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={exportExcel}
        disabled={exporting !== null}
        className="btn-primary flex items-center gap-2 text-xs"
      >
        {exporting === 'excel'
          ? <Loader2 size={14} className="animate-spin" />
          : <FileSpreadsheet size={14} />}
        Excel ({data.length})
      </button>
      <button
        onClick={exportJSON}
        className="btn-primary flex items-center gap-2 text-xs"
      >
        <FileJson size={14} />
        JSON ({data.length})
      </button>
    </div>
  )
}
