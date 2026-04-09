import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ChevronLeft } from "lucide-react";
import { payoutSettingsApi } from "@/services/payoutSettingsApi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Invoice = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await payoutSettingsApi.getInvoiceDetails(id || '');
        if (response?.success) {
          setInvoice(response.data);
        }
      } catch (error) {
        console.error('Error fetching invoice:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  const formatCurrency = (amount: number) => {
    return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return <div className="p-8 text-center">Loading invoice...</div>;
  }

  if (!invoice) {
    return <div className="p-8 text-center text-red-500">Invoice not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center text-sm text-muted-foreground gap-2">
          <button onClick={() => navigate('/dashboard/payments')} className="hover:text-foreground hover:underline transition-colors">Billing</button>
          <span>/</span>
          <span className="text-foreground font-medium">Invoice #{invoice.id}</span>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => window.print()}>
          <Download className="h-4 w-4" />
          Download Invoice
        </Button>
      </div>

      {/* PDF Viewer Mock container */}
      <div className="bg-zinc-800 rounded-md p-4 pt-0 shadow-lg min-h-[800px]">
        {/* PDF toolbar mock */}
        <div className="flex items-center gap-4 text-zinc-400 py-3 mb-4 text-sm border-b border-zinc-700 overflow-x-auto">
           <div className="flex items-center gap-2 px-2 hover:bg-zinc-700 rounded cursor-pointer">
             <span>☰</span>
           </div>
           <div className="bg-zinc-700 px-3 py-1 rounded text-zinc-200 truncate max-w-[200px]">
             invoice_{invoice.id}.pdf
           </div>
           <div className="ml-auto flex items-center gap-4">
             <span>1 / 1</span>
             <span className="cursor-pointer hover:text-white">-</span>
             <span>100%</span>
             <span className="cursor-pointer hover:text-white">+</span>
             {/* other icons mock */}
             <span className="cursor-pointer hover:text-white text-lg">↻</span>
             <Download className="h-4 w-4 cursor-pointer hover:text-white" />
             <span className="cursor-pointer hover:text-white">🖨</span>
           </div>
        </div>

        {/* PDF Page (White canvas) */}
        <Card className="bg-white text-black min-h-[600px] border-0 rounded-none shadow-sm max-w-4xl mx-auto">
          <CardContent className="p-16">
            <h1 className="text-4xl font-normal mb-8">Invoice</h1>
            <div className="text-muted-foreground text-sm uppercase tracking-wider mb-8">
              #{invoice.id.toUpperCase()}
            </div>

            <hr className="border-t-2 border-gray-200 mb-8" />

            <div className="mb-6 font-semibold text-lg">Details</div>

            <div className="grid grid-cols-2 gap-y-3 mb-10 text-sm max-w-md">
              <div className="font-semibold text-gray-700">Creation Date:</div>
              <div>{invoice.creation_date}</div>
              
              <div className="font-semibold text-gray-700">Billing Period:</div>
              <div>{invoice.billing_period}</div>
              
              <div className="font-semibold text-gray-700">Due On:</div>
              <div>{invoice.due_on}</div>
              
              <div className="font-semibold text-gray-700">Status:</div>
              <div className="capitalize">{invoice.status}</div>
            </div>

            <Table className="mb-6">
              <TableHeader className="bg-gray-600/90 text-white">
                <TableRow className="hover:bg-gray-600/90">
                  <TableHead className="text-white">Description</TableHead>
                  <TableHead className="text-center text-white">Total Conversions</TableHead>
                  <TableHead className="text-right text-white">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="hover:bg-gray-50 border-b border-gray-300">
                  <TableCell className="font-medium text-gray-900">{invoice.description}</TableCell>
                  <TableCell className="text-center text-gray-900">{invoice.conversions || 1}</TableCell>
                  <TableCell className="text-right font-medium text-gray-900">{formatCurrency(invoice.amount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            
            <hr className="border-t border-gray-300 my-4" />
            
            <div className="flex justify-between items-center text-sm px-4">
              <div className="font-bold text-gray-900">Total</div>
              <div className="font-bold text-gray-900">{formatCurrency(invoice.amount)}</div>
            </div>
            <hr className="border-t border-gray-300 my-4" />

          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Invoice;
