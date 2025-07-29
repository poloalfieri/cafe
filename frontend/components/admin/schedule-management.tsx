"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  Calendar,
  MapPin,
  Users,
  Save,
  X
} from "lucide-react"

interface Schedule {
  day: string
  open: boolean
  openTime: string
  closeTime: string
}

interface Table {
  id: string
  name: string
  capacity: number
  status: "available" | "occupied" | "reserved" | "maintenance"
  location?: string
}

export default function ScheduleManagement() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [tableFormData, setTableFormData] = useState({
    name: "",
    capacity: "",
    location: "",
    status: "available"
  })

  const daysOfWeek = [
    "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"
  ]

  const tableStatuses = [
    { value: "available", label: "Disponible", color: "bg-green-100 text-green-700" },
    { value: "occupied", label: "Ocupada", color: "bg-red-100 text-red-700" },
    { value: "reserved", label: "Reservada", color: "bg-yellow-100 text-yellow-700" },
    { value: "maintenance", label: "Mantenimiento", color: "bg-gray-100 text-gray-700" }
  ]

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Simular datos de horarios - en producción esto vendría de tu API
      const mockSchedules: Schedule[] = daysOfWeek.map(day => ({
        day,
        open: day !== "Domingo",
        openTime: "08:00",
        closeTime: day === "Sábado" ? "23:00" : "22:00"
      }))
      setSchedules(mockSchedules)

      // Simular datos de mesas
      const mockTables: Table[] = [
        { id: "1", name: "Mesa 1", capacity: 4, status: "available", location: "Interior" },
        { id: "2", name: "Mesa 2", capacity: 2, status: "occupied", location: "Interior" },
        { id: "3", name: "Mesa 3", capacity: 6, status: "available", location: "Terraza" },
        { id: "4", name: "Mesa 4", capacity: 4, status: "reserved", location: "Interior" },
        { id: "5", name: "Mesa 5", capacity: 2, status: "maintenance", location: "Terraza" }
      ]
      setTables(mockTables)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleScheduleChange = (day: string, field: keyof Schedule, value: any) => {
    setSchedules(schedules.map(schedule => 
      schedule.day === day ? { ...schedule, [field]: value } : schedule
    ))
  }

  const handleTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const tableData: Table = {
      ...tableFormData,
      id: editingTable?.id || Date.now().toString(),
      capacity: parseInt(tableFormData.capacity),
      status: tableFormData.status as "available" | "occupied" | "reserved" | "maintenance"
    }

    if (editingTable) {
      // Actualizar mesa existente
      setTables(tables.map(t => t.id === editingTable.id ? tableData : t))
    } else {
      // Crear nueva mesa
      setTables([...tables, tableData])
    }

    resetTableForm()
    setIsTableDialogOpen(false)
  }

  const handleTableEdit = (table: Table) => {
    setEditingTable(table)
    setTableFormData({
      name: table.name,
      capacity: table.capacity.toString(),
      location: table.location || "",
      status: table.status
    })
    setIsTableDialogOpen(true)
  }

  const handleTableDelete = (tableId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta mesa?")) {
      setTables(tables.filter(t => t.id !== tableId))
    }
  }

  const resetTableForm = () => {
    setTableFormData({
      name: "",
      capacity: "",
      location: "",
      status: "available"
    })
    setEditingTable(null)
  }

  const getStatusInfo = (status: string) => {
    return tableStatuses.find(s => s.value === status) || tableStatuses[0]
  }

  const saveSchedules = async () => {
    // Aquí iría la lógica para guardar los horarios en la API
    console.log("Guardando horarios:", schedules)
    alert("Horarios guardados correctamente")
  }

  return (
    <div className="space-y-8">
      {/* Gestión de Horarios */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Horarios de Apertura</h2>
            <p className="text-gray-600">Configura los horarios de apertura y cierre por día</p>
          </div>
          <Button onClick={saveSchedules} className="bg-gray-900 hover:bg-gray-800 text-white">
            <Save className="w-4 h-4 mr-2" />
            Guardar Horarios
          </Button>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div key={schedule.day} className="flex items-center gap-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-24">
                  <Label className="font-bold text-gray-900 text-sm">{schedule.day}</Label>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`open-${schedule.day}`}
                    checked={schedule.open}
                    onChange={(e) => handleScheduleChange(schedule.day, "open", e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-gray-300 focus:ring-gray-900 focus:ring-2"
                  />
                  <Label htmlFor={`open-${schedule.day}`} className="text-sm font-medium text-gray-700">
                    Abierto
                  </Label>
                </div>

                {schedule.open && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-blue-600" />
                      </div>
                      <Input
                        type="time"
                        value={schedule.openTime}
                        onChange={(e) => handleScheduleChange(schedule.day, "openTime", e.target.value)}
                        className="w-32 border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                      />
                    </div>
                    
                    <span className="text-gray-600 font-medium">a</span>
                    
                    <div className="flex items-center gap-3">
                      <Input
                        type="time"
                        value={schedule.closeTime}
                        onChange={(e) => handleScheduleChange(schedule.day, "closeTime", e.target.value)}
                        className="w-32 border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                      />
                    </div>
                  </>
                )}

                {!schedule.open && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <X className="w-4 h-4 text-red-600" />
                    </div>
                    <span className="text-red-600 font-medium text-sm">Cerrado</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gestión de Mesas */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestión de Mesas</h2>
            <p className="text-gray-600">Administra las mesas del local</p>
          </div>
          <Dialog open={isTableDialogOpen} onOpenChange={setIsTableDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetTableForm()} className="bg-gray-900 hover:bg-gray-800 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Mesa
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-white border border-gray-200">
              <DialogHeader>
                <DialogTitle className="text-gray-900">
                  {editingTable ? "Editar Mesa" : "Crear Nueva Mesa"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleTableSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tableName" className="text-gray-700 font-medium">Nombre de la Mesa</Label>
                    <Input
                      id="tableName"
                      value={tableFormData.name}
                      onChange={(e) => setTableFormData({ ...tableFormData, name: e.target.value })}
                      placeholder="Ej: Mesa 1"
                      required
                      className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity" className="text-gray-700 font-medium">Capacidad</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      max="12"
                      value={tableFormData.capacity}
                      onChange={(e) => setTableFormData({ ...tableFormData, capacity: e.target.value })}
                      placeholder="4"
                      required
                      className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-gray-700 font-medium">Ubicación</Label>
                    <Select value={tableFormData.location} onValueChange={(value) => setTableFormData({ ...tableFormData, location: value })}>
                      <SelectTrigger className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900">
                        <SelectValue placeholder="Seleccionar ubicación" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Interior">Interior</SelectItem>
                        <SelectItem value="Terraza">Terraza</SelectItem>
                        <SelectItem value="Barra">Barra</SelectItem>
                        <SelectItem value="Ventana">Ventana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-gray-700 font-medium">Estado</Label>
                    <Select value={tableFormData.status} onValueChange={(value) => setTableFormData({ ...tableFormData, status: value as any })}>
                      <SelectTrigger className="border-2 border-gray-300 focus:border-gray-900 focus:ring-gray-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tableStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsTableDialogOpen(false)}
                    className="border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    className="bg-gray-900 hover:bg-gray-800 text-white font-medium"
                  >
                    {editingTable ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Vista de mesas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.map((table) => {
            const statusInfo = getStatusInfo(table.status)
            
            return (
              <div
                key={table.id}
                className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{table.name}</h3>
                    <p className="text-gray-600 text-sm">{table.location}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-gray-700 font-medium">
                    Capacidad: {table.capacity} personas
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTableEdit(table)}
                    className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 font-medium"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTableDelete(table.id)}
                    className="border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {tables.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay mesas registradas</h3>
            <p className="text-gray-600 mb-4">Crea tu primera mesa para comenzar a gestionar el local</p>
            <Button 
              onClick={() => setIsTableDialogOpen(true)} 
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Mesa
            </Button>
          </div>
        )}
      </div>
    </div>
  )
} 