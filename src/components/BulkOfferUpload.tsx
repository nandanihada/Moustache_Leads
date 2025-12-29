import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
    Upload,
    FileSpreadsheet,
    Download,
    Link,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { bulkOfferApi } from '@/services/bulkOfferApi';

interface BulkOfferUploadProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUploadComplete?: () => void;
}

interface UploadResult {
    success: boolean;
    created_count: number;
    error_count?: number;
    created_offer_ids: string[];
    validation_errors?: Array<{
        row: number;
        errors: string[];
    }>;
    creation_errors?: Array<{
        row: number;
        error: string;
    }>;
    message: string;
}

export const BulkOfferUpload: React.FC<BulkOfferUploadProps> = ({
    open,
    onOpenChange,
    onUploadComplete,
}) => {
    const { toast } = useToast();
    const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [googleSheetUrl, setGoogleSheetUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Validate file type
            const validTypes = [
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/csv'
            ];

            if (!validTypes.includes(file.type) &&
                !file.name.endsWith('.xlsx') &&
                !file.name.endsWith('.xls') &&
                !file.name.endsWith('.csv')) {
                toast({
                    title: 'Invalid File Type',
                    description: 'Please upload an Excel (.xlsx, .xls) or CSV file',
                    variant: 'destructive',
                });
                return;
            }

            setSelectedFile(file);
            setUploadResult(null);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            setSelectedFile(file);
            setUploadResult(null);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDownloadTemplate = async () => {
        try {
            await bulkOfferApi.downloadTemplate();
            toast({
                title: 'Template Downloaded',
                description: 'Template file has been downloaded successfully',
            });
        } catch (error: any) {
            toast({
                title: 'Download Failed',
                description: error.message || 'Failed to download template',
                variant: 'destructive',
            });
        }
    };

    const handleUpload = async () => {
        if (uploadMode === 'file' && !selectedFile) {
            toast({
                title: 'No File Selected',
                description: 'Please select a file to upload',
                variant: 'destructive',
            });
            return;
        }

        if (uploadMode === 'url' && !googleSheetUrl.trim()) {
            toast({
                title: 'No URL Provided',
                description: 'Please enter a Google Sheets URL',
                variant: 'destructive',
            });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadResult(null);

        try {
            let result: UploadResult;

            if (uploadMode === 'file' && selectedFile) {
                // Simulate progress
                setUploadProgress(30);
                result = await bulkOfferApi.uploadFile(selectedFile);
            } else {
                setUploadProgress(30);
                result = await bulkOfferApi.uploadFromGoogleSheets(googleSheetUrl);
            }

            setUploadProgress(100);
            setUploadResult(result);

            if (result.success && result.created_count > 0) {
                toast({
                    title: 'Upload Successful',
                    description: `Successfully created ${result.created_count} offers`,
                });

                // Call completion callback
                if (onUploadComplete) {
                    setTimeout(() => {
                        onUploadComplete();
                    }, 1500);
                }
            } else {
                toast({
                    title: 'Upload Completed with Errors',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('Upload error:', error);

            // Check if error has validation details
            if (error.validation_errors) {
                setUploadResult({
                    success: false,
                    created_count: 0,
                    message: error.message || 'Validation errors found',
                    validation_errors: error.validation_errors,
                    error_count: error.error_count,
                } as UploadResult);
            } else {
                toast({
                    title: 'Upload Failed',
                    description: error.message || 'An error occurred during upload',
                    variant: 'destructive',
                });
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setGoogleSheetUrl('');
        setUploadResult(null);
        setUploadProgress(0);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Bulk Upload Offers
                    </DialogTitle>
                    <DialogDescription>
                        Upload a spreadsheet to create multiple offers at once
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Download Template Button */}
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadTemplate}
                            className="gap-2"
                        >
                            <Download className="h-4 w-4" />
                            Download Template
                        </Button>
                    </div>

                    {/* Upload Tabs */}
                    <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as 'file' | 'url')}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="file">
                                <Upload className="h-4 w-4 mr-2" />
                                Upload File
                            </TabsTrigger>
                            <TabsTrigger value="url">
                                <Link className="h-4 w-4 mr-2" />
                                Google Sheets URL
                            </TabsTrigger>
                        </TabsList>

                        {/* File Upload Tab */}
                        <TabsContent value="file" className="space-y-4">
                            <div
                                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                                        ? 'border-primary bg-primary/5'
                                        : 'border-gray-300 hover:border-primary/50'
                                    }`}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                            >
                                {selectedFile ? (
                                    <div className="space-y-2">
                                        <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
                                        <p className="font-medium">{selectedFile.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {(selectedFile.size / 1024).toFixed(2)} KB
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedFile(null)}
                                        >
                                            Remove File
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Upload className="h-12 w-12 mx-auto text-gray-400" />
                                        <p className="font-medium">
                                            Drag and drop your file here, or click to browse
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            Supports Excel (.xlsx, .xls) and CSV files
                                        </p>
                                        <Input
                                            type="file"
                                            accept=".xlsx,.xls,.csv"
                                            onChange={handleFileSelect}
                                            className="max-w-xs mx-auto mt-4"
                                        />
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* Google Sheets URL Tab */}
                        <TabsContent value="url" className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="google-sheet-url">Google Sheets URL</Label>
                                <Input
                                    id="google-sheet-url"
                                    type="url"
                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                    value={googleSheetUrl}
                                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                                />
                                <p className="text-sm text-gray-500">
                                    Make sure the Google Sheet is publicly accessible
                                </p>
                            </div>

                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Note:</strong> The Google Sheet must be shared with "Anyone with the link can view"
                                </AlertDescription>
                            </Alert>
                        </TabsContent>
                    </Tabs>

                    {/* Upload Progress */}
                    {isUploading && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Uploading...</span>
                                <span className="text-sm text-gray-500">{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} />
                        </div>
                    )}

                    {/* Upload Results */}
                    {uploadResult && (
                        <div className="space-y-4">
                            {uploadResult.success ? (
                                <Alert className="border-green-500 bg-green-50">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <AlertDescription className="text-green-800">
                                        {uploadResult.message}
                                        <ul className="mt-2 space-y-1 text-sm">
                                            <li>✅ Created: {uploadResult.created_count} offers</li>
                                            {uploadResult.created_offer_ids.length > 0 && (
                                                <li className="mt-2 text-xs text-green-600">
                                                    Offer IDs: {uploadResult.created_offer_ids.join(', ')}
                                                </li>
                                            )}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert variant="destructive">
                                    <XCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {uploadResult.message}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Validation Errors */}
                            {uploadResult.validation_errors && uploadResult.validation_errors.length > 0 && (
                                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-red-50">
                                    <h4 className="font-semibold text-sm mb-2 text-red-800">
                                        Validation Errors ({uploadResult.validation_errors.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {uploadResult.validation_errors.map((err, idx) => (
                                            <div key={idx} className="text-sm border-l-2 border-red-400 pl-3 py-1">
                                                <p className="font-medium text-red-700">Row {err.row}:</p>
                                                <ul className="list-disc list-inside text-red-600 ml-2">
                                                    {err.errors.map((error, errIdx) => (
                                                        <li key={errIdx}>{error}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Creation Errors */}
                            {uploadResult.creation_errors && uploadResult.creation_errors.length > 0 && (
                                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-yellow-50">
                                    <h4 className="font-semibold text-sm mb-2 text-yellow-800">
                                        Creation Errors ({uploadResult.creation_errors.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {uploadResult.creation_errors.map((err, idx) => (
                                            <div key={idx} className="text-sm border-l-2 border-yellow-400 pl-3 py-1">
                                                <p className="font-medium text-yellow-700">Row {err.row}:</p>
                                                <p className="text-yellow-600 ml-2">{err.error}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={handleClose}>
                            Close
                        </Button>
                        <Button
                            onClick={handleUpload}
                            disabled={
                                isUploading ||
                                (uploadMode === 'file' && !selectedFile) ||
                                (uploadMode === 'url' && !googleSheetUrl.trim())
                            }
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload Offers
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
