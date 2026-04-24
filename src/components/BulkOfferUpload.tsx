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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { bulkOfferApi, BulkUploadJobStatus } from '@/services/bulkOfferApi';
import { API_BASE_URL } from '@/services/apiConfig';

interface BulkOfferUploadProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUploadComplete?: () => void;
}

interface UploadResult {
    success: boolean;
    created_count: number;
    error_count?: number;
    duplicate_count?: number;
    created_offer_ids: string[];
    validation_errors?: Array<{
        row: number;
        errors: string[];
        missing_fields?: string[];
        warnings?: string[];
    }>;
    missing_offers?: Array<{
        row: number;
        missing_fields: string[];
        warnings?: string[];
    }>;
    validation_feedback?: {
        summary: string;
        total_issues: number;
        required_fields: Array<{
            field: string;
            description: string;
            required: boolean;
        }>;
        special_network_info: {
            networks: string[];
            description: string;
            requirement: string;
        };
        errors_by_type: {
            missing_fields: Array<{
                row: number;
                missing: string[];
            }>;
            invalid_format: Array<{
                row: number;
                error: string;
            }>;
            invalid_values: Array<{
                row: number;
                error: string;
            }>;
        };
        fix_suggestions: Array<{
            field: string;
            issue: string;
            solution: string;
            example: string;
        }>;
        column_mapping: {
            description: string;
            mappings: Record<string, string[]>;
        };
    };
    creation_errors?: Array<{
        row: number;
        error: string;
    }>;
    skipped_duplicates?: Array<{
        row: number;
        reason: string;
        existing_offer_id: string;
        match_type: string;
    }>;
    message: string;
    can_skip_invalid?: boolean;
    valid_count?: number;
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
    const [importStep, setImportStep] = useState<string>('');
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Default values for imported offers
    const [defaultStatus, setDefaultStatus] = useState<string>('active');
    const [defaultStarRating, setDefaultStarRating] = useState<number>(4);
    const [defaultTimer, setDefaultTimer] = useState<number>(0); // 0 = no timer
    
    // Approval workflow options
    const [approvalType, setApprovalType] = useState<string>('auto_approve');
    const [autoApproveDelay, setAutoApproveDelay] = useState<number>(0);
    const [autoApproveDelayUnit, setAutoApproveDelayUnit] = useState<string>('minutes');
    const [showInOfferwall, setShowInOfferwall] = useState<boolean>(true);
    const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
    
    // Email notification options
    const [sendEmail, setSendEmail] = useState<boolean>(false);
    const [emailRecipients, setEmailRecipients] = useState<string>('all_publishers');
    const [emailSchedule, setEmailSchedule] = useState<string>('now');
    const [emailScheduleTime, setEmailScheduleTime] = useState<string>('');
    const [offersPerEmail, setOffersPerEmail] = useState<number>(0); // 0 = all in one email
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [publishersList, setPublishersList] = useState<Array<{_id: string; username: string; email: string}>>([]);
    const [publisherSearch, setPublisherSearch] = useState('');
    const [loadingPublishers, setLoadingPublishers] = useState(false);
    
    // Async job tracking state
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<BulkUploadJobStatus | null>(null);
    const pollingRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchPublishers = async () => {
        if (publishersList.length > 0) return;
        setLoadingPublishers(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/auth/admin/users?status=approved`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const users = (data.users || []).map((u: any) => ({
                _id: u._id || u.id,
                username: u.username || u.first_name || '',
                email: u.email || ''
            }));
            setPublishersList(users);
        } catch { /* ignore */ } finally {
            setLoadingPublishers(false);
        }
    };

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

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const startPolling = (jobId: string) => {
        stopPolling();
        pollingRef.current = setInterval(async () => {
            try {
                const status = await bulkOfferApi.getJobStatus(jobId);
                setJobStatus(status);

                const pct = status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;
                setUploadProgress(pct);
                const rawTotal = status.total_raw || status.total;
                const validationSkipped = status.validation_skipped || 0;
                const validationNote = validationSkipped > 0 ? ` (${validationSkipped} rows skipped in validation)` : '';
                setImportStep(
                    status.status === 'validating'
                        ? `🔍 Validating & mapping fields...`
                        : status.current_offer
                        ? `⚙️ Processing: ${status.processed} / ${status.total} — ${status.current_offer}${validationNote}`
                        : `⚙️ Processing: ${status.processed} / ${status.total}${validationNote}`
                );

                if (status.status === 'completed' || status.status === 'failed') {
                    stopPolling();
                    setIsUploading(false);
                    setActiveJobId(null);

                    if (status.status === 'completed') {
                        setUploadProgress(100);
                        setImportStep('✅ Import complete!');

                        const validationSkipped = status.validation_skipped || 0;
                        const totalRaw = status.total_raw || status.total;
                        let msg = `Created ${status.succeeded} offers`;
                        if (status.failed > 0) msg += `, ${status.failed} failed`;
                        if (status.skipped_duplicates.length > 0) msg += `, ${status.skipped_duplicates.length} skipped`;
                        if (validationSkipped > 0) msg += `, ${validationSkipped} rows skipped during validation (missing required fields)`;
                        msg += ` in ${status.elapsed_seconds}s`;
                        if (validationSkipped > 0) msg += ` (${totalRaw} total rows in file, ${status.valid_count || status.total} passed validation)`;

                        setUploadResult({
                            success: status.succeeded > 0,
                            created_count: status.succeeded,
                            error_count: status.failed,
                            duplicate_count: status.skipped_duplicates.length,
                            validation_skipped: validationSkipped,
                            total_raw: totalRaw,
                            valid_count: status.valid_count || status.total,
                            validation_errors_sample: status.validation_errors_sample || [],
                            created_offer_ids: status.created_ids,
                            skipped_duplicates: status.skipped_duplicates.map(d => ({
                                row: d.row,
                                reason: d.reason,
                                existing_offer_id: d.existing_offer_id || '',
                                match_type: d.reason,
                            })),
                            creation_errors: status.errors.map(e => ({
                                row: e.row || 0,
                                error: e.error,
                            })),
                            message: msg,
                        });

                        toast({
                            title: 'Upload Successful',
                            description: `Created ${status.succeeded} offers in ${status.elapsed_seconds}s`,
                        });

                        if (onUploadComplete) {
                            setTimeout(() => onUploadComplete(), 1500);
                        }
                    } else {
                        setImportStep('');
                        setUploadProgress(0);
                        const errMsg = status.errors.length > 0 ? status.errors[0].error : 'Background job failed';
                        setUploadResult({
                            success: false,
                            created_count: status.succeeded,
                            error_count: status.failed,
                            created_offer_ids: status.created_ids,
                            message: `Job failed: ${errMsg}`,
                        });
                        toast({
                            title: 'Upload Failed',
                            description: errMsg,
                            variant: 'destructive',
                        });
                    }
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 2000);
    };

    // Cleanup polling on unmount
    React.useEffect(() => {
        return () => stopPolling();
    }, []);

    const handleUpload = async (skipInvalidRows: boolean = false) => {
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
        setImportStep('');
        
        // Don't clear uploadResult if we're retrying with skip_invalid_rows
        if (!skipInvalidRows) {
            setUploadResult(null);
        }

        try {
            // Build options object with approval settings
            const uploadOptions = {
                approval_type: approvalType,
                auto_approve_delay: autoApproveDelay,
                require_approval: approvalType !== 'auto_approve',
                show_in_offerwall: showInOfferwall,
                default_status: defaultStatus,
                default_star_rating: defaultStarRating,
                default_timer: defaultTimer,
                duplicate_strategy: skipDuplicates ? 'skip' : 'create_new',
                skip_invalid_rows: skipInvalidRows,
                send_email: sendEmail,
                email_recipients: emailRecipients,
                email_schedule: emailSchedule,
                email_schedule_time: emailScheduleTime,
                offers_per_email: offersPerEmail,
                selected_user_ids: emailRecipients === 'specific_users' ? selectedUserIds : [],
            };

            let asyncResponse;

            if (uploadMode === 'file' && selectedFile) {
                setUploadProgress(10);
                setImportStep('📂 Uploading file & validating...');
                asyncResponse = await bulkOfferApi.uploadFileAsync(selectedFile, uploadOptions);
            } else {
                setUploadProgress(10);
                setImportStep('🌐 Fetching Google Sheet & validating...');
                asyncResponse = await bulkOfferApi.uploadFromGoogleSheetsAsync(googleSheetUrl, uploadOptions);
            }

            // Got job_id — start polling
            setActiveJobId(asyncResponse.job_id);
            setUploadProgress(15);
            setImportStep(`⚙️ Validating & mapping: 0 / ${asyncResponse.total}`);
            startPolling(asyncResponse.job_id);
        } catch (error: any) {
            console.error('Upload error:', error);
            console.log('Error object:', {
                validation_errors: error.validation_errors,
                validation_feedback: error.validation_feedback,
                missing_offers: error.missing_offers,
                message: error.message
            });
            setImportStep('');
            setUploadProgress(0);

            // Check if error has validation details
            if (error.validation_errors || error.validation_feedback || error.missing_offers) {
                setUploadResult({
                    success: false,
                    created_count: 0,
                    message: error.message || 'Validation errors found',
                    validation_errors: error.validation_errors,
                    missing_offers: error.missing_offers,
                    validation_feedback: error.validation_feedback,
                    error_count: error.error_count,
                    created_offer_ids: [],
                    can_skip_invalid: error.can_skip_invalid,
                    valid_count: error.valid_count,
                } as UploadResult);
                
                // Don't show toast - the detailed feedback will be displayed in the UI
            } else {
                toast({
                    title: 'Upload Failed',
                    description: error.message || 'An error occurred during upload',
                    variant: 'destructive',
                });
            }
        } finally {
            // Only reset isUploading if no active polling (errors are handled here, success is handled by polling)
            if (!activeJobId && !pollingRef.current) {
                setIsUploading(false);
            }
        }
    };

    const handleClose = () => {
        stopPolling();
        setSelectedFile(null);
        setGoogleSheetUrl('');
        setUploadResult(null);
        setUploadProgress(0);
        setImportStep('');
        setActiveJobId(null);
        setJobStatus(null);
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

                    {/* Default Values for Imported Offers */}
                    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            ⚙️ Default Values for Imported Offers
                        </h4>
                        <div className="space-y-2 mb-4">
                            <Label htmlFor="bulk-default-status">Default Status</Label>
                            <Select value={defaultStatus} onValueChange={setDefaultStatus}>
                                <SelectTrigger id="bulk-default-status">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">🟢 Active</SelectItem>
                                    <SelectItem value="pending">🟡 Pending</SelectItem>
                                    <SelectItem value="inactive">⚫ Inactive</SelectItem>
                                    <SelectItem value="paused">⏸️ Paused</SelectItem>
                                    <SelectItem value="hidden">👁️ Hidden</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="default-rating">Star Rating (1-5)</Label>
                                <Select 
                                    value={defaultStarRating.toString()} 
                                    onValueChange={(v) => setDefaultStarRating(parseInt(v))}
                                >
                                    <SelectTrigger id="default-rating">
                                        <SelectValue placeholder="Select rating" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">⭐ 1 Star</SelectItem>
                                        <SelectItem value="2">⭐⭐ 2 Stars</SelectItem>
                                        <SelectItem value="3">⭐⭐⭐ 3 Stars</SelectItem>
                                        <SelectItem value="4">⭐⭐⭐⭐ 4 Stars</SelectItem>
                                        <SelectItem value="5">⭐⭐⭐⭐⭐ 5 Stars</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">Rating shown on offer cards</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="default-timer">Timer (minutes)</Label>
                                <Input
                                    id="default-timer"
                                    type="number"
                                    min="0"
                                    max="999"
                                    placeholder="e.g., 15"
                                    value={defaultTimer || ''}
                                    onChange={(e) => setDefaultTimer(parseInt(e.target.value) || 0)}
                                />
                                <p className="text-xs text-muted-foreground">0 = no timer, enter any value</p>
                            </div>
                        </div>
                    </div>

                    {/* Approval Workflow Settings */}
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            🔐 Approval Workflow
                        </h4>
                        <div className="space-y-3">
                            {/* Show in Offerwall Option */}
                            <div className="flex items-center space-x-2 p-2 bg-white rounded border">
                                <input
                                    type="checkbox"
                                    id="show-in-offerwall-bulk"
                                    checked={showInOfferwall}
                                    onChange={(e) => setShowInOfferwall(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <label htmlFor="show-in-offerwall-bulk" className="text-sm cursor-pointer">
                                    🖼️ Show offers in Offerwall (visible to users)
                                </label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                If unchecked, offers will be imported but hidden from the offerwall until manually enabled
                            </p>
                            
                            {/* Skip Duplicates Option */}
                            <div className="flex items-center space-x-2 p-2 bg-white rounded border">
                                <input
                                    type="checkbox"
                                    id="skip-duplicates-bulk"
                                    checked={skipDuplicates}
                                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <label htmlFor="skip-duplicates-bulk" className="text-sm cursor-pointer">
                                    🔍 Skip Duplicate Offers (recommended)
                                </label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                If checked, offers that already exist (same campaign ID, name+network, or URL) will be skipped. Uncheck to allow duplicates.
                            </p>
                            
                            {/* Send Email Notification Option */}
                            <div className="flex items-center space-x-2 p-2 bg-white rounded border">
                                <input
                                    type="checkbox"
                                    id="send-email-bulk"
                                    checked={sendEmail}
                                    onChange={(e) => setSendEmail(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <label htmlFor="send-email-bulk" className="text-sm cursor-pointer">
                                    📧 Send email notification to publishers
                                </label>
                            </div>
                            
                            {sendEmail && (
                                <div className="space-y-3 ml-2 pl-3 border-l-2 border-blue-200">
                                    {/* To Whom */}
                                    <div className="space-y-1">
                                        <Label className="text-xs font-medium">Send To</Label>
                                        <Select value={emailRecipients} onValueChange={(v) => { setEmailRecipients(v); if (v === 'specific_users') fetchPublishers(); }}>
                                            <SelectTrigger className="h-8 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all_publishers">👥 All Publishers</SelectItem>
                                                <SelectItem value="active_publishers">✅ Active Publishers Only</SelectItem>
                                                <SelectItem value="specific_users">🎯 Select Specific Users</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    {emailRecipients === 'specific_users' && (
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium">Select Users ({selectedUserIds.length} selected)</Label>
                                            <Input
                                                placeholder="Search by name or email..."
                                                value={publisherSearch}
                                                onChange={(e) => setPublisherSearch(e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                            <div className="max-h-32 overflow-y-auto border rounded p-1 bg-white space-y-0.5">
                                                {loadingPublishers ? (
                                                    <p className="text-xs text-center py-2 text-muted-foreground">Loading...</p>
                                                ) : publishersList
                                                    .filter(u => !publisherSearch || u.username.toLowerCase().includes(publisherSearch.toLowerCase()) || u.email.toLowerCase().includes(publisherSearch.toLowerCase()))
                                                    .map(u => (
                                                        <label key={u._id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-xs">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedUserIds.includes(u._id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedUserIds(prev => [...prev, u._id]);
                                                                    else setSelectedUserIds(prev => prev.filter(id => id !== u._id));
                                                                }}
                                                                className="h-3 w-3"
                                                            />
                                                            <span>{u.username}</span>
                                                            <span className="text-muted-foreground">{u.email}</span>
                                                        </label>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* When to Send */}
                                    <div className="space-y-1">
                                        <Label className="text-xs font-medium">When to Send</Label>
                                        <Select value={emailSchedule} onValueChange={setEmailSchedule}>
                                            <SelectTrigger className="h-8 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="now">⚡ Send Immediately</SelectItem>
                                                <SelectItem value="scheduled">🕐 Schedule for Later</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    {emailSchedule === 'scheduled' && (
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium">Schedule Date & Time</Label>
                                            <Input
                                                type="datetime-local"
                                                value={emailScheduleTime}
                                                onChange={(e) => setEmailScheduleTime(e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    )}
                                    
                                    {/* Offers per Email */}
                                    <div className="space-y-1">
                                        <Label className="text-xs font-medium">Offers per Email</Label>
                                        <Select 
                                            value={offersPerEmail.toString()} 
                                            onValueChange={(v) => setOffersPerEmail(parseInt(v))}
                                        >
                                            <SelectTrigger className="h-8 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0">📦 All offers in one email</SelectItem>
                                                <SelectItem value="5">5 offers per email</SelectItem>
                                                <SelectItem value="10">10 offers per email</SelectItem>
                                                <SelectItem value="20">20 offers per email</SelectItem>
                                                <SelectItem value="50">50 offers per email</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            All users receive the same email via BCC (single send, no spam risk)
                                        </p>
                                    </div>
                                </div>
                            )}
                            
                            {!sendEmail && (
                                <p className="text-xs text-muted-foreground">
                                    No email will be sent to publishers about these offers
                                </p>
                            )}
                            
                            <div className="space-y-2">
                                <Label htmlFor="bulk-approval-type">Approval Type</Label>
                                <Select 
                                    value={approvalType} 
                                    onValueChange={setApprovalType}
                                >
                                    <SelectTrigger id="bulk-approval-type">
                                        <SelectValue placeholder="Select approval type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto_approve">🟢 Direct Access (Instant)</SelectItem>
                                        <SelectItem value="time_based">⏰ Time-Based Auto-Approval</SelectItem>
                                        <SelectItem value="manual">🔐 Manual Admin Approval</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {approvalType === 'auto_approve' && 'Offers will be immediately accessible to all users'}
                                    {approvalType === 'time_based' && 'Offers will be locked until the delay period passes'}
                                    {approvalType === 'manual' && 'Offers will require manual admin approval for each user'}
                                </p>
                            </div>
                            
                            {approvalType === 'time_based' && (
                                <div className="space-y-2">
                                    <Label htmlFor="bulk-approval-delay">Auto-Approve Delay</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="bulk-approval-delay"
                                            type="number"
                                            min="1"
                                            placeholder="e.g., 60"
                                            value={
                                                autoApproveDelayUnit === 'days' 
                                                    ? Math.floor(autoApproveDelay / 1440) || ''
                                                    : autoApproveDelayUnit === 'hours'
                                                        ? Math.floor(autoApproveDelay / 60) || ''
                                                        : autoApproveDelay || ''
                                            }
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                let minutes = value;
                                                if (autoApproveDelayUnit === 'hours') minutes = value * 60;
                                                if (autoApproveDelayUnit === 'days') minutes = value * 1440;
                                                setAutoApproveDelay(minutes);
                                            }}
                                            className="w-24"
                                        />
                                        <Select
                                            value={autoApproveDelayUnit}
                                            onValueChange={setAutoApproveDelayUnit}
                                        >
                                            <SelectTrigger className="w-28">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="minutes">Minutes</SelectItem>
                                                <SelectItem value="hours">Hours</SelectItem>
                                                <SelectItem value="days">Days</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Users will get auto-approved after{' '}
                                        {autoApproveDelay >= 1440 
                                            ? `${Math.floor(autoApproveDelay / 1440)} day(s)`
                                            : autoApproveDelay >= 60
                                                ? `${Math.floor(autoApproveDelay / 60)} hour(s)`
                                                : `${autoApproveDelay} minutes`
                                        }
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Upload Progress */}
                    {isUploading && (
                        <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">
                                    {importStep || 'Processing...'}
                                </span>
                            </div>
                            <Progress value={uploadProgress} className="h-2" />
                            <div className="flex justify-between text-xs text-blue-600">
                                {jobStatus ? (
                                    <>
                                        <span>{jobStatus.processed} / {jobStatus.total} offers processed</span>
                                        <span>{uploadProgress}%</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Uploading & validating...</span>
                                        <span>{uploadProgress}%</span>
                                    </>
                                )}
                            </div>
                            {jobStatus && (
                                <div className="flex gap-3 text-xs mt-1">
                                    <span className="text-green-600">✅ {jobStatus.succeeded} succeeded</span>
                                    {jobStatus.failed > 0 && (
                                        <span className="text-red-600">❌ {jobStatus.failed} failed</span>
                                    )}
                                    {jobStatus.skipped_duplicates.length > 0 && (
                                        <span className="text-amber-600">⏭️ {jobStatus.skipped_duplicates.length} skipped</span>
                                    )}
                                    <span className="text-gray-500 ml-auto">{jobStatus.elapsed_seconds}s elapsed</span>
                                </div>
                            )}
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
                                            {uploadResult.duplicate_count && uploadResult.duplicate_count > 0 && (
                                                <li>⏭️ Skipped: {uploadResult.duplicate_count} duplicates</li>
                                            )}
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

                            {/* Detailed Validation Feedback */}
                            {uploadResult.validation_feedback && (
                                <div className="border rounded-lg p-4 bg-amber-50 space-y-4">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-amber-900 mb-2">
                                                Validation Issues Found
                                            </h4>
                                            <p className="text-sm text-amber-800 mb-4">
                                                {uploadResult.validation_feedback.summary}
                                            </p>

                                            {/* Show skip option if there are valid rows */}
                                            {uploadResult.can_skip_invalid && uploadResult.valid_count && uploadResult.valid_count > 0 && (
                                                <Alert className="mb-4 bg-green-50 border-green-200">
                                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                    <AlertDescription className="text-green-800">
                                                        <strong>Good news!</strong> You have {uploadResult.valid_count} valid offer(s) in your spreadsheet.
                                                        <div className="mt-2">
                                                            You can either:
                                                            <ul className="list-disc list-inside ml-2 mt-1">
                                                                <li>Fix the invalid rows and re-upload the entire sheet</li>
                                                                <li>Click "Skip Invalid & Upload Valid Offers" below to proceed with only the valid offers</li>
                                                            </ul>
                                                        </div>
                                                    </AlertDescription>
                                                </Alert>
                                            )}

                                            {/* Special Network Info */}
                                            {uploadResult.validation_feedback.special_network_info && (
                                                <Alert className="mb-4 bg-blue-50 border-blue-200">
                                                    <AlertCircle className="h-4 w-4 text-blue-600" />
                                                    <AlertDescription className="text-blue-800">
                                                        <strong>Special Networks:</strong>{' '}
                                                        {uploadResult.validation_feedback.special_network_info.description}
                                                        <div className="mt-2 text-sm">
                                                            <strong>Networks:</strong>{' '}
                                                            {uploadResult.validation_feedback.special_network_info.networks.join(', ')}
                                                        </div>
                                                        <div className="text-sm">
                                                            <strong>Requirement:</strong>{' '}
                                                            {uploadResult.validation_feedback.special_network_info.requirement}
                                                        </div>
                                                    </AlertDescription>
                                                </Alert>
                                            )}

                                            {/* Fix Suggestions */}
                                            {uploadResult.validation_feedback.fix_suggestions && 
                                             uploadResult.validation_feedback.fix_suggestions.length > 0 && (
                                                <div className="space-y-3">
                                                    <h5 className="font-semibold text-sm text-amber-900">
                                                        How to Fix Your Spreadsheet:
                                                    </h5>
                                                    {uploadResult.validation_feedback.fix_suggestions.map((suggestion, idx) => (
                                                        <div key={idx} className="bg-white rounded p-3 border border-amber-200">
                                                            <div className="flex items-start gap-2">
                                                                <span className="text-amber-600 font-bold">
                                                                    {idx + 1}.
                                                                </span>
                                                                <div className="flex-1">
                                                                    <p className="font-medium text-amber-900 mb-1">
                                                                        {suggestion.issue}
                                                                    </p>
                                                                    <p className="text-sm text-amber-800 mb-2">
                                                                        {suggestion.solution}
                                                                    </p>
                                                                    <div className="bg-gray-100 rounded px-2 py-1 text-xs font-mono text-gray-700">
                                                                        Example: {suggestion.example}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Required Fields Reference */}
                                            {uploadResult.validation_feedback.required_fields && (
                                                <details className="mt-4">
                                                    <summary className="cursor-pointer font-semibold text-sm text-amber-900 hover:text-amber-700">
                                                        View All Required Fields
                                                    </summary>
                                                    <div className="mt-2 space-y-2 pl-4">
                                                        {uploadResult.validation_feedback.required_fields.map((field, idx) => (
                                                            <div key={idx} className="text-sm">
                                                                <span className="font-mono text-amber-700">
                                                                    {field.field}
                                                                </span>
                                                                {' - '}
                                                                <span className="text-amber-800">
                                                                    {field.description}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}

                                            {/* Column Mapping Reference */}
                                            {uploadResult.validation_feedback.column_mapping && (
                                                <details className="mt-4">
                                                    <summary className="cursor-pointer font-semibold text-sm text-amber-900 hover:text-amber-700">
                                                        View Accepted Column Names
                                                    </summary>
                                                    <div className="mt-2 space-y-2 pl-4">
                                                        <p className="text-xs text-amber-700 mb-2">
                                                            {uploadResult.validation_feedback.column_mapping.description}
                                                        </p>
                                                        {Object.entries(uploadResult.validation_feedback.column_mapping.mappings).map(([field, names], idx) => (
                                                            <div key={idx} className="text-sm">
                                                                <span className="font-semibold text-amber-800">
                                                                    {field}:
                                                                </span>
                                                                {' '}
                                                                <span className="font-mono text-amber-700">
                                                                    {names.join(', ')}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    </div>
                                </div>
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
                                                {err.errors && err.errors.length > 0 && (
                                                    <ul className="list-disc list-inside text-red-600 ml-2">
                                                        {err.errors.map((error, errIdx) => (
                                                            <li key={errIdx}>{error}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {err.missing_fields && err.missing_fields.length > 0 && (
                                                    <div className="ml-2 mt-1">
                                                        <span className="text-red-700 font-medium">Missing fields: </span>
                                                        <span className="text-red-600">{err.missing_fields.join(', ')}</span>
                                                    </div>
                                                )}
                                                {err.warnings && err.warnings.length > 0 && (
                                                    <ul className="list-disc list-inside text-amber-600 ml-2 mt-1">
                                                        {err.warnings.map((warning, warnIdx) => (
                                                            <li key={warnIdx}>{warning}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Missing Offers */}
                            {uploadResult.missing_offers && uploadResult.missing_offers.length > 0 && (
                                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-orange-50">
                                    <h4 className="font-semibold text-sm mb-2 text-orange-800">
                                        Rows with Missing Required Fields ({uploadResult.missing_offers.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {uploadResult.missing_offers.map((missing, idx) => (
                                            <div key={idx} className="text-sm border-l-2 border-orange-400 pl-3 py-1">
                                                <p className="font-medium text-orange-700">Row {missing.row}:</p>
                                                <div className="ml-2">
                                                    <span className="text-orange-700 font-medium">Missing: </span>
                                                    <span className="text-orange-600">{missing.missing_fields.join(', ')}</span>
                                                </div>
                                                {missing.warnings && missing.warnings.length > 0 && (
                                                    <ul className="list-disc list-inside text-amber-600 ml-2 mt-1">
                                                        {missing.warnings.map((warning, warnIdx) => (
                                                            <li key={warnIdx}>{warning}</li>
                                                        ))}
                                                    </ul>
                                                )}
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

                            {/* Validation Summary — shows when rows were skipped during validation */}
                            {uploadResult.validation_skipped > 0 && (
                                <div className="border rounded-lg p-4 bg-amber-50">
                                    <h4 className="font-semibold text-sm mb-1 text-amber-800">
                                        ⚠️ Validation: {uploadResult.validation_skipped} of {uploadResult.total_raw} rows skipped
                                    </h4>
                                    <p className="text-xs text-amber-700 mb-2">
                                        Only {uploadResult.valid_count} rows passed validation. The rest were missing required fields (name, URL, payout, etc).
                                    </p>
                                    {uploadResult.validation_errors_sample && uploadResult.validation_errors_sample.length > 0 && (
                                        <div className="space-y-1 max-h-40 overflow-y-auto mt-2">
                                            {uploadResult.validation_errors_sample.map((ve: any, idx: number) => (
                                                <div key={idx} className="text-xs border-l-2 border-amber-400 pl-2 py-0.5">
                                                    <span className="font-medium text-amber-700">Row {ve.row}:</span>{' '}
                                                    <span className="text-amber-600">{ve.name || 'Unknown'} — {ve.error}</span>
                                                </div>
                                            ))}
                                            {uploadResult.validation_skipped > uploadResult.validation_errors_sample.length && (
                                                <p className="text-xs text-amber-500 italic mt-1">
                                                    ...and {uploadResult.validation_skipped - uploadResult.validation_errors_sample.length} more
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Skipped Duplicates */}
                            {uploadResult.skipped_duplicates && uploadResult.skipped_duplicates.length > 0 && (
                                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-blue-50">
                                    <h4 className="font-semibold text-sm mb-2 text-blue-800">
                                        ⏭️ Skipped Duplicates ({uploadResult.skipped_duplicates.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {uploadResult.skipped_duplicates.map((dup, idx) => (
                                            <div key={idx} className="text-sm border-l-2 border-blue-400 pl-3 py-1">
                                                <p className="font-medium text-blue-700">Row {dup.row}:</p>
                                                <p className="text-blue-600 ml-2">
                                                    Matched existing offer: <span className="font-mono">{dup.existing_offer_id}</span>
                                                    <span className="text-xs ml-2">({dup.match_type})</span>
                                                </p>
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
                        
                        {/* Show "Skip Invalid & Upload Valid" button when there are validation errors but also valid rows */}
                        {uploadResult && !uploadResult.success && uploadResult.can_skip_invalid && uploadResult.valid_count && uploadResult.valid_count > 0 && (
                            <Button
                                onClick={() => handleUpload(true)}
                                disabled={isUploading}
                                variant="secondary"
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Skip Invalid & Upload {uploadResult.valid_count} Valid Offers
                                    </>
                                )}
                            </Button>
                        )}
                        
                        {/* Regular upload button - hide if we're showing the skip button */}
                        {!(uploadResult && !uploadResult.success && uploadResult.can_skip_invalid) && (
                            <Button
                                onClick={() => handleUpload(false)}
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
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
