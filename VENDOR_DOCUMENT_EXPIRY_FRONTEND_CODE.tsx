/**
 * VENDOR DOCUMENT EXPIRY - FRONTEND CODE FIX
 * 
 * Use this code to update src/pages/VendorRegistrationReview.tsx
 * 
 * Replace the existing helper functions and handleDownloadDocument function
 * with the code below
 */

// ============================================
// ADD THESE HELPER FUNCTIONS (near top of component, after imports)
// ============================================

/**
 * Check if a document has passed its expiry date
 */
const isDocumentExpired = (document: VendorDocument): boolean => {
  if (!document.expiryDate) return false;
  return new Date(document.expiryDate) < new Date();
};

/**
 * Check if a document is expiring within the specified number of days
 */
const isDocumentExpiringsooon = (document: VendorDocument, daysWarning: number = 30): boolean => {
  if (!document.expiryDate) return false;
  const expiryDate = new Date(document.expiryDate);
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + daysWarning);
  return expiryDate <= warningDate && expiryDate > new Date();
};

/**
 * Calculate days remaining until document expires
 * Returns null if no expiry date
 */
const getDaysUntilExpiry = (expiryDate: string | undefined): number | null => {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Get color className for expiry status display
 */
const getExpiryStatusColor = (document: VendorDocument): string => {
  if (!document.expiryDate) return 'text-muted-foreground';
  if (isDocumentExpired(document)) return 'text-destructive';
  if (isDocumentExpiringsooon(document, 30)) return 'text-warning';
  return 'text-muted-foreground';
};

/**
 * Get display label for expiry status
 */
const getExpiryStatusLabel = (document: VendorDocument): string => {
  if (!document.expiryDate) return 'No expiry date';
  if (isDocumentExpired(document)) return '⏸️ EXPIRED - Cannot download';
  
  const daysLeft = getDaysUntilExpiry(document.expiryDate);
  if (daysLeft === null) return 'No expiry date';
  
  if (daysLeft <= 0) return '⏸️ EXPIRED - Cannot download';
  if (daysLeft <= 30) {
    return `⚠️ Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
  }
  
  return `Expires: ${new Date(document.expiryDate).toLocaleDateString()}`;
};

// ============================================
// REPLACE THE handleDownloadDocument FUNCTION
// ============================================

const handleDownloadDocument = async (document: VendorDocument) => {
  // ✅ VALIDATION 1: Check if document is expired
  if (isDocumentExpired(document)) {
    toast({
      title: "Document Expired",
      description: `${document.name} expired on ${new Date(document.expiryDate!).toLocaleDateString()}. Please upload a renewed version.`,
      variant: "destructive",
    });
    console.warn('Document download blocked - document expired:', document.id, document.expiryDate);
    return;
  }

  // ✅ VALIDATION 2: Warn if expiring soon
  const daysLeft = getDaysUntilExpiry(document.expiryDate);
  if (daysLeft !== null && daysLeft <= 30 && daysLeft > 0) {
    console.warn(`⚠️ Document ${document.name} (${document.id}) will expire in ${daysLeft} days`);
  }

  // Get document details with fallbacks for field name variations
  const doc = document as any;
  const registrationId = registration?.id;
  const fileName = doc.fileName || doc.file_name || doc.name || doc.original_name || doc.originalName || 'document';
  const documentId = doc.id || doc.document_id;
  const directUrl = doc.file_share_url || doc.fileShareUrl || doc.file_url || doc.fileUrl;

  console.log('Document download initiated:', {
    documentId,
    registrationId,
    fileName,
    hasDirectUrl: !!directUrl,
    expiryDate: document.expiryDate,
    daysUntilExpiry: daysLeft,
  });

  try {
    // ✅ PATH 1: Direct URL available (OneDrive, S3 Public)
    if (directUrl && directUrl.startsWith('http')) {
      const link = document.createElement('a');
      link.href = directUrl;
      link.download = fileName;
      link.click();
      
      toast({
        title: "Opening Document",
        description: "Document is being downloaded. Check your downloads folder.",
      });
      console.log('✅ Document downloaded via direct URL');
    } 
    // ✅ PATH 2: Use API endpoint
    else if (id && documentId) {
      console.log('📥 Using API download endpoint for document:', documentId);

      try {
        const response = await vendorApi.downloadDocument(id, documentId);

        if (response.success) {
          console.log('✅ Document downloaded successfully via API');
          toast({
            title: "Downloaded",
            description: "Document downloaded successfully",
          });
        } else {
          // ✅ VALIDATION 3: Check if error is due to expiry
          if (response.error?.includes('expired') || response.error?.includes('Expired')) {
            console.warn('Document download blocked by backend - document expired');
            toast({
              title: "Document Expired",
              description: response.error || "This document has expired",
              variant: "destructive",
            });
          } else {
            console.error('API download error:', response.error);
            toast({
              title: "Download Failed",
              description: response.error || "Unable to download document",
              variant: "destructive",
            });
          }
        }
      } catch (apiError) {
        console.error('❌ Exception during API download:', apiError);
        toast({
          title: "Error",
          description: "An error occurred while downloading the document",
          variant: "destructive",
        });
      }
    } 
    // ✅ PATH 3: No valid download method found
    else {
      toast({
        title: "Error",
        description: "Unable to download document - no document ID or direct URL found",
        variant: "destructive",
      });
      console.error('❌ No download method available:', { documentId, hasDirectUrl: !!directUrl, registrationId: id });
    }
  } catch (error) {
    console.error('❌ Unexpected download error:', error);
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Failed to download document",
      variant: "destructive",
    });
  }
};

// ============================================
// REPLACE THE DOCUMENTS RENDERING SECTION
// ============================================

{/* Documents */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <FileText className="h-5 w-5" />
      Uploaded Documents
    </CardTitle>
    <CardDescription>
      {documents.length} document{documents.length !== 1 ? "s" : ""} uploaded
    </CardDescription>
  </CardHeader>
  <CardContent>
    {documents.length === 0 ? (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No documents uploaded</p>
      </div>
    ) : (
      <div className="space-y-3">
        {/* Render each document */}
        {documents.map((doc, index) => {
          const expired = isDocumentExpired(doc);
          const expiringSoon = isDocumentExpiringsooon(doc, 30) && !expired;
          
          return (
            <div
              key={doc.id || index}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                expired 
                  ? 'bg-destructive/5 border-destructive/20' 
                  : expiringSoon 
                  ? 'bg-warning/5 border-warning/20' 
                  : 'bg-card hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileText className={`h-8 w-8 shrink-0 ${expired ? 'text-destructive' : expiringSoon ? 'text-warning' : 'text-primary'}`} />
                <div className="min-w-0">
                  <p className="font-medium truncate">{getDocumentLabel(doc.type)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.fileName || doc.name} • {formatFileSize(doc.fileSize)}
                  </p>
                  {doc.expiryDate && (
                    <>
                      <div className={`text-xs flex items-center gap-1 mt-1 font-semibold ${getExpiryStatusColor(doc)}`}>
                        <Clock className="h-3 w-3" />
                        {getExpiryStatusLabel(doc)}
                      </div>
                      {expired && (
                        <p className="text-xs text-destructive mt-1 font-medium">
                          📝 This document needs to be renewed
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* Download button */}
              {((doc as any).file_share_url || (doc as any).fileShareUrl) ? (
                <OneDriveLink
                  webUrl={(doc as any).file_share_url || (doc as any).fileShareUrl}
                  fileName={doc.fileName || doc.name}
                  variant="button"
                  size="sm"
                  disabled={expired}
                />
              ) : (
                <Button
                  variant={expired ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => handleDownloadDocument(doc)}
                  disabled={expired}
                  title={expired ? "This document has expired and cannot be downloaded" : "Download document"}
                  className="shrink-0"
                >
                  <Download className="h-4 w-4 mr-1" />
                  {expired ? "Expired" : "Download"}
                </Button>
              )}
            </div>
          );
        })}
        
        {/* ⏸️ EXPIRED DOCUMENTS WARNING */}
        {documents.some(d => isDocumentExpired(d)) && (
          <div className="mt-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg animate-pulse">
            <p className="text-sm text-destructive font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {documents.filter(d => isDocumentExpired(d)).length} document{documents.filter(d => isDocumentExpired(d)).length !== 1 ? 's' : ''} 
                {' '}expired and need{documents.filter(d => isDocumentExpired(d)).length !== 1 ? '' : 's'} renewal
              </span>
            </p>
          </div>
        )}
        
        {/* ⚠️ EXPIRING SOON WARNING */}
        {documents.some(d => isDocumentExpiringsooon(d, 30) && !isDocumentExpired(d)) && (
          <div className="mt-2 p-3 bg-warning/5 border border-warning/20 rounded-lg">
            <p className="text-sm text-warning font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                {documents.filter(d => isDocumentExpiringsooon(d, 30) && !isDocumentExpired(d)).length} document{documents.filter(d => isDocumentExpiringsooon(d, 30) && !isDocumentExpired(d)).length !== 1 ? 's' : ''} 
                {' '}will expire within 30 days
              </span>
            </p>
          </div>
        )}
      </div>
    )}
  </CardContent>
</Card>

// ============================================
// MAKE SURE THESE IMPORTS EXIST AT TOP OF FILE
// ============================================

import { AlertCircle, Clock, Download } from 'lucide-react';
// These should already be imported, verify they are present
