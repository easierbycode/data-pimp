import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button.tsx";
import { Box, Package, QrCode, ArrowRight, Scan, CheckCircle, Info } from "lucide-react";

export default function README() {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Box className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Inventory Manager</h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            A comprehensive inventory management system for tracking product samples and bundles with barcode/QR checkout workflow.
          </p>
        </div>

        {/* Quick Start */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Link to={createPageUrl('Samples')}>
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <Box className="w-6 h-6" />
                  <span>Browse Samples</span>
                </Button>
              </Link>
              <Link to={createPageUrl('Bundles')}>
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
                  <Package className="w-6 h-6" />
                  <span>View Bundles</span>
                </Button>
              </Link>
              <Link to={createPageUrl('Checkout')}>
                <Button className="w-full h-auto py-4 flex flex-col items-center gap-2 bg-slate-900">
                  <QrCode className="w-6 h-6" />
                  <span>Checkout Station</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Demo Data */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Demo Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-slate-600">
                This app comes pre-loaded with demo data to help you explore all features:
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Box className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium">100 Sample Products</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Beauty products from brands like Glow Labs, Pure Skin, Luxe Beauty, Seoul Glow, and more.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-indigo-600" />
                    <span className="font-medium">15 Bundles</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Collections like Summer Beauty Essentials, K-Beauty Favorites, and Travel Minis.
                  </p>
                </div>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Sample Codes:</strong> Try scanning codes like <code className="bg-amber-100 px-1 rounded">SMP-001</code> through <code className="bg-amber-100 px-1 rounded">SMP-100</code> for samples, 
                  or <code className="bg-amber-100 px-1 rounded">BND-SUMMER-001</code> through <code className="bg-amber-100 px-1 rounded">BND-SUN-015</code> for bundles.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How Scanning Works */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="w-5 h-5" />
              How Scanning Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <p className="text-slate-600">
                The checkout station supports both barcode scanners and manual entry:
              </p>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-medium">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900">Keyboard Wedge Scanners</h4>
                    <p className="text-sm text-slate-500">
                      Most USB barcode scanners work as "keyboard wedge" devices - they type the barcode value like a keyboard. 
                      The app detects rapid key sequences and automatically processes them as scans.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-medium">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900">Manual Entry</h4>
                    <p className="text-sm text-slate-500">
                      You can also type a code manually and press Enter. The scanner input stays focused automatically.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-medium">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900">Code Lookup</h4>
                    <p className="text-sm text-slate-500">
                      When a code is scanned, the system first checks if it matches a sample's QR code, then checks bundles. 
                      Results appear instantly with checkout/checkin actions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="font-medium text-slate-900">Sample Management</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Create, edit, delete samples</li>
                  <li>• Track status (available, checked out, reserved, discontinued)</li>
                  <li>• Fire sale flagging</li>
                  <li>• Price tracking with best price source</li>
                  <li>• TikTok affiliate links</li>
                  <li>• Image upload support</li>
                  <li>• Filter by brand, status, location</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-slate-900">Bundle Management</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Group samples into bundles</li>
                  <li>• Single QR code for entire bundle</li>
                  <li>• Add/remove samples from bundles</li>
                  <li>• Shared location for bundle items</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-slate-900">Checkout Workflow</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Scan samples or bundles</li>
                  <li>• Check out/in individual items</li>
                  <li>• Bulk checkout for bundles</li>
                  <li>• Track who items are checked out to</li>
                  <li>• Recent scans history</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-slate-900">Audit Trail</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Transaction history for all actions</li>
                  <li>• Track checkout/checkin timestamps</li>
                  <li>• Operator tracking</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Badges */}
        <Card>
          <CardHeader>
            <CardTitle>Status Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Available</Badge>
                <span className="text-sm text-slate-500">Ready for checkout</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">Checked Out</Badge>
                <span className="text-sm text-slate-500">Currently in use</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">Reserved</Badge>
                <span className="text-sm text-slate-500">Reserved for future use</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-slate-100 text-slate-800 border-slate-200">Discontinued</Badge>
                <span className="text-sm text-slate-500">No longer available</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}