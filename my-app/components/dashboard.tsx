"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Loader2, Plus, Printer, Trash, Edit, Menu, Search, Undo, X } from "lucide-react"
import { collection, setDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebaseconfig'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const orderStatuses = [
  "Order Received",
  "Retrieved from Manufacturer",
  "At Photography Studio",
  "Collected from Studio",
  "Returned to Manufacturer",
  "Pre Printing",
  "Printing",
  "Post Printing",
  "Photos Delivered",
] as const

type OrderStatus = typeof orderStatuses[number]

interface Order {
  id: string
  client: string
  manufacturer: string
  product: string
  quantity: number
  status: OrderStatus
  date: string
  timeline: { status: OrderStatus; timestamp: string }[]
}

async function getNextOrderNumber() {
  const orderCounterRef = doc(db, 'counters', 'orderCounter');
  const orderCounterSnap = await getDoc(orderCounterRef);

  if (!orderCounterSnap.exists()) {
    await setDoc(orderCounterRef, { count: 1 });
    return 1;
  } else {
    const newCount = orderCounterSnap.data().count + 1;
    await updateDoc(orderCounterRef, { count: newCount });
    return newCount;
  }
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    client: "",
    manufacturer: "",
    quantity: 0,
  })
  const [isAddingOrder, setIsAddingOrder] = useState(false)
  const [selectedChallanOrders, setSelectedChallanOrders] = useState<string[]>([])
  const [challanType, setChallanType] = useState("")
  const [photosDelivered, setPhotosDelivered] = useState<Record<string, number>>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [clients, setClients] = useState<string[]>([])
  const [manufacturers, setManufacturers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [collapsedOrders, setCollapsedOrders] = useState<Record<string, boolean>>({})
  const [newClient, setNewClient] = useState("")
  const [newManufacturer, setNewManufacturer] = useState("")

  useEffect(() => {
    const fetchOrders = async () => {
      const ordersCollection = collection(db, 'orders')
      const ordersQuery = query(ordersCollection, orderBy('date', 'desc'))
      const querySnapshot = await getDocs(ordersQuery)
      const fetchedOrders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]
      setOrders(fetchedOrders)

      // Extract unique clients and manufacturers
      const uniqueClients = Array.from(new Set(fetchedOrders.map(order => order.client).filter(client => client && client.trim() !== "")))
      const uniqueManufacturers = Array.from(new Set(fetchedOrders.map(order => order.manufacturer).filter(manufacturer => manufacturer && manufacturer.trim() !== "")))
      setClients(uniqueClients)
      setManufacturers(uniqueManufacturers)

      // Initialize collapsed state for completed orders
      const initialCollapsedState = fetchedOrders.reduce((acc, order) => {
        if (order.status === "Photos Delivered") {
          acc[order.id] = true
        }
        return acc
      }, {} as Record<string, boolean>)
      setCollapsedOrders(initialCollapsedState)
    }

    fetchOrders()
  }, [])

  const totalOrders = orders.length
  const activeOrders = orders.filter(order => order.status !== "Photos Delivered").length
  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1
    return acc
  }, {} as Record<OrderStatus, number>)

  const handleAddOrder = async () => {
    setIsAddingOrder(true);
    try {
      const nextNumber = await getNextOrderNumber();
      const orderId = `ORD${String(nextNumber).padStart(4, '0')}`;
      
      let clientName = newOrder.client;
      if (newOrder.client === "new" && newClient.trim() !== "") {
        clientName = newClient.trim();
        if (clientName) {
          setClients(prevClients => {
            const updatedClients = new Set(prevClients);
            if (clientName) {
              updatedClients.add(clientName);
            }
            return Array.from(updatedClients);
          });
        }
      }

      let manufacturerName = newOrder.manufacturer;
      if (newOrder.manufacturer === "new" && newManufacturer.trim() !== "") {
        manufacturerName = newManufacturer.trim();
        setManufacturers(prevManufacturers => {
          if (manufacturerName) {
            const updatedManufacturers = new Set(prevManufacturers);
            updatedManufacturers.add(manufacturerName);
            return Array.from(updatedManufacturers);
          }
          return prevManufacturers;
        });
      }

      const orderToAdd: Order = {
        id: orderId,
        client: clientName || "",
        manufacturer: manufacturerName || "",
        product: "Sarees",
        quantity: newOrder.quantity || 0,
        status: "Order Received",
        date: new Date().toISOString().split('T')[0],
        timeline: [{ status: "Order Received", timestamp: new Date().toISOString() }]
      };
      
      await setDoc(doc(db, 'orders', orderId), orderToAdd);
      setOrders([orderToAdd, ...orders]);
      setNewOrder({ client: "", manufacturer: "", quantity: 0 });
      setNewClient("");
      setNewManufacturer("");
      setIsAddingOrder(false);
      setIsDialogOpen(false);
      console.log("Order added successfully");
    } catch (error) {
      console.error("Error adding order: ", error);
      setIsAddingOrder(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const orderRef = doc(db, 'orders', orderId)
      const updatedTimeline = [...orders.find(o => o.id === orderId)!.timeline, { status: newStatus, timestamp: new Date().toISOString() }]
      await updateDoc(orderRef, { 
        status: newStatus,
        timeline: updatedTimeline
      })

      const updatedOrders = orders.map(order =>
        order.id === orderId ? {
          ...order,
          status: newStatus,
          timeline: updatedTimeline
        } : order
      )
      setOrders(updatedOrders)
      if (newStatus === "Photos Delivered") {
        setCollapsedOrders(prev => ({ ...prev, [orderId]: true }))
      }
      console.log("Order status updated successfully")
    } catch (error) {
      console.error("Error updating order status: ", error)
    }
  }

  const handleUndoStatus = async (orderId: string) => {
    const orderToUpdate = orders.find(order => order.id === orderId)
    if (orderToUpdate && orderToUpdate.timeline.length > 1) {
      const updatedTimeline = orderToUpdate.timeline.slice(0, -1)
      const updatedStatus = updatedTimeline[updatedTimeline.length - 1].status
      try {
        const orderRef = doc(db, 'orders', orderId)
        await updateDoc(orderRef, { 
          status: updatedStatus,
          timeline: updatedTimeline
        })

        const updatedOrders = orders.map(order =>
          order.id === orderId ? {
            ...order,
            status: updatedStatus,
            timeline: updatedTimeline
          } : order
        )
        setOrders(updatedOrders)
        if (updatedStatus !== "Photos Delivered") {
          setCollapsedOrders(prev => ({ ...prev, [orderId]: false }))
        }
        console.log("Order status undone successfully")
      } catch (error) {
        console.error("Error undoing order status: ", error)
      }
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, 'orders', orderId))
      const updatedOrders = orders.filter(order => order.id !== orderId)
      setOrders(updatedOrders)
      console.log("Order deleted successfully")
    } catch (error) {
      console.error("Error deleting order: ", error)
    }
  }

  const handleEditOrder = async (orderId: string, updatedOrder: Partial<Order>) => {
    try {
      const orderRef = doc(db, 'orders', orderId)
      await updateDoc(orderRef, updatedOrder)
      const updatedOrders = orders.map(order =>
        order.id === orderId ? { ...order, ...updatedOrder } : order
      )
      setOrders(updatedOrders)
      setIsDialogOpen(false)
      console.log("Order updated successfully")
    } catch (error) {
      console.error("Error updating order: ", error)
    }
  }

  const handleGenerateChallan = () => {
    if (!challanType || selectedChallanOrders.length === 0) {
      console.error("Cannot generate challan: No challan type or orders selected")
      return
    }
  
    const challanContent = generateChallanContent(challanType, selectedChallanOrders)
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(challanContent);
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    } else {
      console.error("Failed to open print window");
    }
  
    // Reset selections
    setChallanType("")
    setSelectedChallanOrders([])
    setPhotosDelivered({})
  }

  const generateChallanContent = (type: string, orderIds: string[]) => {
    const selectedOrders = orders.filter(order => orderIds.includes(order.id))
    const currentDate = format(new Date(), "MMMM d, yyyy")
    let content = `
      <html>
        <head>
          <title>Challan - ${type}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .page { width: 210mm; height: 297mm; padding: 10mm; box-sizing: border-box; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10mm; }
            th, td { border: 1px solid black; padding: 2mm; text-align: left; font-size: 10pt; }
            h1 { text-align: center; font-size: 14pt; margin-bottom: 5mm; }
            .header { text-align: center; margin-bottom: 5mm; }
            .logo { width: 100px; height: auto; } /* Adjust size as needed */
            .company-info { font-size: 12pt; }
            .signature-line { border-bottom: 1px dotted black; height: 15mm; }
            @media print {
              .page { page-break-after: always; }
            }
          </style>
        </head>
        <body>
    `

    if (type === "master") {
      content += generateMasterChallan(selectedOrders[0], currentDate)
    } else {
      selectedOrders.forEach(order => {
        content += generateRegularChallan(type, order, currentDate)
      })
    }

    content += `
        </body>
      </html>
    `

    return content
  }

  const generateRegularChallan = (type: string, order: Order, currentDate: string) => {
    return `
      <div class="page">
        <div class="header">
          <img src="/logo.png" alt="Company Logo" class="logo">
          <div class="company-info">
            <font size="10"> Patel offset </font> <br><br>
            Mo. - 7043051052
          </div>
          <div class="date">${currentDate}</div>
        </div>
        <h1>Challan - ${type}</h1>
        <table>
          <tr>
            <th>Order ID</th>
            <th>Client</th>
            <th>Manufacturer</th>
            <th>Product</th>
            <th>Quantity</th>
            ${type === "photos" ? "<th>Prints</th>" : ""}
          </tr>
          <tr>
            <td>${order.id}</td>
            <td>${order.client}</td>
            <td>${order.manufacturer}</td>
            <td>${order.product}</td>
            <td>${order.quantity}</td>
            ${type === "photos" ? `<td>${photosDelivered[order.id] || ''}</td>` : ""}
          </tr>
        </table>
        <div style="display: flex; justify-content: space-between; margin-top: 20mm;">
          <div>
            <p>Received By: _________________</p>
            <p>Date: _______________________</p>
          </div>
          <div>
            <p>Authorized Signature: _________________</p>
          </div>
        </div>
      </div>
    `
  }

  const generateMasterChallan = (order:  Order, currentDate: string) => {
    return `
      <div class="page">
        <div class="header">
          <img src="/logo.png" alt="Company Logo" class="logo">
          <div class="company-info">
          <font size="10"> Patel offset </font> <br><br>
            Mo. - 7043051052
          </div>
          <div class="date">${currentDate}</div>
        </div>
        <h1>Master Challan</h1>
        <table>
          <tr>
            <th>Order ID</th>
            <th>Client</th>
            <th>Manufacturer</th>
            <th>Product</th>
            <th>Quantity</th>
            <th>Prints</th>
          </tr>
          <tr>
            <td>${order.id}</td>
            <td>${order.client}</td>
            <td>${order.manufacturer}</td>
            <td>${order.product}</td>
            <td>${order.quantity}</td>
            <td>${photosDelivered[order.id] || ''}</td>
          </tr>
        </table>
        <h2>Order Process</h2>
        <table>
          ${orderStatuses.map(status => `
            <tr>
              <td style="width: 50%;">${status}</td>
              <td class="signature-line"></td>
            </tr>
          `).join('')}
        </table>
        <div style="margin-top: 20mm;">
          <p>Authorized Signature: _________________________</p>
          <p>Date: _______________________</p>
        </div>
      </div>
    `
  }

  const toggleOrderCollapse = (orderId: string) => {
    setCollapsedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }))
  }

  return (
    <div className="container mx-auto py-10">
      <Tabs defaultValue="orders" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="challans">Challans</TabsTrigger>
          </TabsList>
          <div className="flex items-center space-x-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Order
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>
        <TabsContent value="orders" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeOrders}</div>
              </CardContent>
            </Card>
            {/* Add more summary cards as needed */}
          </div>
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Status
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {orderStatuses.map((status) => (
                  <DropdownMenuItem key={status}>
                    {status} ({statusCounts[status] || 0})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <AnimatePresence>
            {orders
              .filter(
                (order) =>
                  order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  order.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  order.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
              >
                {index > 0 && (
                  <Separator className="my-4" />
                )}
                <Card className={order.status === "Photos Delivered" ? "opacity-50" : ""}>
                  <CardHeader 
                    className="flex flex-row items-center justify-between cursor-pointer"
                    onClick={() => order.status === "Photos Delivered" && toggleOrderCollapse(order.id)}
                  >
                    <div>
                      <CardTitle>{order.id} - {order.client}</CardTitle>
                      <CardDescription>{format(new Date(order.date), "MMMM d, yyyy")}</CardDescription>
                    </div>
                    <div className="flex items-center">
                      {order.status === "Photos Delivered" && (
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            collapsedOrders[order.id] ? "transform rotate-180" : ""
                          }`}
                        />
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Menu className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => {
                            setNewOrder(order)
                            setIsDialogOpen(true)
                          }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Order
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleDeleteOrder(order.id)}>
                            <Trash className="mr-2 h-4 w-4" />
                            Delete Order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  {(!collapsedOrders[order.id] || order.status !== "Photos Delivered") && (
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="font-semibold">Manufacturer:</p>
                          <p>{order.manufacturer}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Product:</p>
                          <p>{order.product}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Quantity:</p>
                          <p>{order.quantity}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Status:</p>
                          <p>{order.status}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2 mb-4 overflow-x-auto">
                        {order.timeline.map((item, index) => (
                          <div key={index} className="flex-shrink-0 w-24 text-center">
                            <div className={`w-6 h-6 mx-auto rounded-full ${index === order.timeline.length - 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <p className="text-xs mt-1">{item.status}</p>
                            <p className="text-xs text-gray-500">{format(new Date(item.timestamp), "MMM d, HH:mm")}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between">
                        <Button 
                          onClick={() => handleUpdateStatus(order.id, orderStatuses[orderStatuses.indexOf(order.status) + 1] as OrderStatus)}
                          disabled={order.status === "Photos Delivered"}
                        >
                          Update Status
                        </Button>
                        <Button variant="outline" onClick={() => handleUndoStatus(order.id)}>
                          <Undo className="mr-2 h-4 w-4" />
                          Undo
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </TabsContent>
        <TabsContent value="challans" className="space-y-4">
          <h2 className="text-2xl font-semibold">Generate Challan</h2>
          <Card>
            <CardHeader>
              <CardTitle>Challan Details</CardTitle>
              <CardDescription>Select challan type and orders to include</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Select onValueChange={(value) => setChallanType(value)}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select challan type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receiving">Receiving from Manufacturer</SelectItem>
                    <SelectItem value="delivering">Delivering to Manufacturer</SelectItem>
                    <SelectItem value="photos">Photos Delivered</SelectItem>
                    <SelectItem value="master">Master Challan</SelectItem>
                  </SelectContent>
                </Select>
                <div>
                  <Label htmlFor="orders">Select Orders</Label>
                  <Select
                    onValueChange={(value) => {
                      if (!selectedChallanOrders.includes(value)) {
                        setSelectedChallanOrders((prev) => [...prev, value]);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select orders" />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.id} - {order.client} - {order.manufacturer} - {format(new Date(order.date), "MMM d, yyyy")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedChallanOrders.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Selected Orders:</h3>
                    <ul>
                      {selectedChallanOrders.map((orderId) => (
                        <li key={orderId} className="flex justify-between items-center mb-2">
                          {orderId}
                          {challanType === "photos" && (
                            <Input
                              type="number"
                              placeholder="No. of photos"
                              className="w-32 mr-2"
                              value={photosDelivered[orderId] || ""}
                              onChange={(e) => setPhotosDelivered({
                                ...photosDelivered,
                                [orderId]: parseInt(e.target.value)
                              })}
                            />
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedChallanOrders(prev => prev.filter(id => id !== orderId))}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button onClick={handleGenerateChallan}>
                  <Printer className="mr-2 h-4 w-4" />
                  Generate and Print Challan
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{newOrder.id ? "Edit Order" : "Add New Order"}</DialogTitle>
            <DialogDescription>
              {newOrder.id ? "Edit the order details. Click save when you're done." : "Enter the details for the new order. Click save when you're done."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="client" className="text-right">
                Client
              </Label>
              <Select
                value={newOrder.client || ""}
                onValueChange={(value) => setNewOrder({ ...newOrder, client: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients
                    .filter(client => client && client.trim() !== "")
                    .map((client) => (
                      <SelectItem key={client} value={client}>
                        {client}
                      </SelectItem>
                    ))}
                  <SelectItem value="new">Add New Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newOrder.client === "new" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="newClient" className="text-right">
                  New Client
                </Label>
                <Input
                  id="newClient"
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  className="col-span-3"
                />
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="manufacturer" className="text-right">
                Manufacturer
              </Label>
              <Select
                value={newOrder.manufacturer || ""}
                onValueChange={(value) => setNewOrder({ ...newOrder, manufacturer: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers
                    .filter(manufacturer => manufacturer && manufacturer.trim() !== "")
                    .map((manufacturer) => (
                      <SelectItem key={manufacturer} value={manufacturer}>
                        {manufacturer}
                      </SelectItem>
                    ))}
                  <SelectItem value="new">Add New Manufacturer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newOrder.manufacturer === "new" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="newManufacturer" className="text-right">
                  New Manufacturer
                </Label>
                <Input
                  id="newManufacturer"
                  value={newManufacturer}
                  onChange={(e) => setNewManufacturer(e.target.value)}
                  className="col-span-3"
                />
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                value={newOrder.quantity || ""}
                onChange={(e) => setNewOrder({ ...newOrder, quantity: parseInt(e.target.value) || 0 })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={newOrder.id ? () => handleEditOrder(newOrder.id!, newOrder) : handleAddOrder} disabled={isAddingOrder}>
              {isAddingOrder ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait
                </>
              ) : (
                newOrder.id ? "Save Changes" : "Save Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}