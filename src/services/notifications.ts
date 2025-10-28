// Email notification templates and service
// Backend needs to implement actual email sending

export interface EmailNotification {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
  }>;
}

// Email templates
export const emailTemplates = {
  mrfCreated: (mrfTitle: string, requester: string, mrfId: string) => ({
    subject: `New MRF Created: ${mrfTitle}`,
    body: `
Dear Procurement Team,

A new Material Requisition Form has been submitted for your review.

MRF ID: ${mrfId}
Title: ${mrfTitle}
Requested by: ${requester}

Please log in to the system to review and process this request.

Best regards,
SCM System
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #10b981;">New MRF Created</h2>
  <p>Dear Procurement Team,</p>
  <p>A new Material Requisition Form has been submitted for your review.</p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px; font-weight: bold;">MRF ID:</td>
      <td style="padding: 8px;">${mrfId}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold;">Title:</td>
      <td style="padding: 8px;">${mrfTitle}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold;">Requested by:</td>
      <td style="padding: 8px;">${requester}</td>
    </tr>
  </table>
  <p>Please log in to the system to review and process this request.</p>
  <a href="${window.location.origin}/procurement" 
     style="display: inline-block; padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
    View Request
  </a>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">
    Best regards,<br>
    SCM System
  </p>
</body>
</html>
    `.trim(),
  }),

  mrfApproved: (mrfTitle: string, approver: string, mrfId: string, remarks?: string) => ({
    subject: `MRF Approved: ${mrfTitle}`,
    body: `
Your Material Requisition Form has been approved.

MRF ID: ${mrfId}
Title: ${mrfTitle}
Approved by: ${approver}
${remarks ? `Remarks: ${remarks}` : ''}

The procurement process will now proceed.

Best regards,
SCM System
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #10b981;">✓ MRF Approved</h2>
  <p>Your Material Requisition Form has been approved.</p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px; font-weight: bold;">MRF ID:</td>
      <td style="padding: 8px;">${mrfId}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold;">Title:</td>
      <td style="padding: 8px;">${mrfTitle}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold;">Approved by:</td>
      <td style="padding: 8px;">${approver}</td>
    </tr>
    ${remarks ? `
    <tr>
      <td style="padding: 8px; font-weight: bold;">Remarks:</td>
      <td style="padding: 8px;">${remarks}</td>
    </tr>
    ` : ''}
  </table>
  <p>The procurement process will now proceed.</p>
  <a href="${window.location.origin}/dashboard" 
     style="display: inline-block; padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
    View Dashboard
  </a>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">
    Best regards,<br>
    SCM System
  </p>
</body>
</html>
    `.trim(),
  }),

  mrfRejected: (mrfTitle: string, approver: string, mrfId: string, reason: string) => ({
    subject: `MRF Rejected: ${mrfTitle}`,
    body: `
Your Material Requisition Form has been rejected.

MRF ID: ${mrfId}
Title: ${mrfTitle}
Rejected by: ${approver}
Reason: ${reason}

You may resubmit the request with the necessary changes.

Best regards,
SCM System
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #ef4444;">✗ MRF Rejected</h2>
  <p>Your Material Requisition Form has been rejected.</p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px; font-weight: bold;">MRF ID:</td>
      <td style="padding: 8px;">${mrfId}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold;">Title:</td>
      <td style="padding: 8px;">${mrfTitle}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold;">Rejected by:</td>
      <td style="padding: 8px;">${approver}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold; vertical-align: top;">Reason:</td>
      <td style="padding: 8px;">${reason}</td>
    </tr>
  </table>
  <p>You may resubmit the request with the necessary changes.</p>
  <a href="${window.location.origin}/dashboard" 
     style="display: inline-block; padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
    View Dashboard
  </a>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">
    Best regards,<br>
    SCM System
  </p>
</body>
</html>
    `.trim(),
  }),

  rfqCreated: (rfqId: string, mrfTitle: string, deadline: string, vendorEmails: string[]) => ({
    subject: `New RFQ: ${mrfTitle}`,
    body: `
Dear Vendor,

You have been invited to submit a quotation for the following request:

RFQ ID: ${rfqId}
Title: ${mrfTitle}
Submission Deadline: ${deadline}

Please log in to the vendor portal to view details and submit your quotation.

Best regards,
Procurement Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #10b981;">New RFQ Invitation</h2>
  <p>Dear Vendor,</p>
  <p>You have been invited to submit a quotation for the following request:</p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px; font-weight: bold;">RFQ ID:</td>
      <td style="padding: 8px;">${rfqId}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold;">Title:</td>
      <td style="padding: 8px;">${mrfTitle}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold;">Deadline:</td>
      <td style="padding: 8px; color: #ef4444;">${deadline}</td>
    </tr>
  </table>
  <p>Please log in to the vendor portal to view details and submit your quotation.</p>
  <a href="${window.location.origin}/vendor-portal" 
     style="display: inline-block; padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
    Submit Quotation
  </a>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">
    Best regards,<br>
    Procurement Team
  </p>
</body>
</html>
    `.trim(),
  }),

  quotationSubmitted: (vendorName: string, rfqId: string, procurementEmail: string) => ({
    subject: `New Quotation Received for ${rfqId}`,
    body: `
A new quotation has been submitted.

RFQ ID: ${rfqId}
Vendor: ${vendorName}

Please log in to review the quotation.

Best regards,
SCM System
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #10b981;">New Quotation Received</h2>
  <p>A new quotation has been submitted.</p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px; font-weight: bold;">RFQ ID:</td>
      <td style="padding: 8px;">${rfqId}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold;">Vendor:</td>
      <td style="padding: 8px;">${vendorName}</td>
    </tr>
  </table>
  <p>Please log in to review the quotation.</p>
  <a href="${window.location.origin}/procurement" 
     style="display: inline-block; padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
    Review Quotation
  </a>
  <p style="color: #666; font-size: 12px; margin-top: 30px;">
    Best regards,<br>
    SCM System
  </p>
</body>
</html>
    `.trim(),
  }),
};

// API endpoint for sending emails (to be implemented in backend)
export const notificationApi = {
  sendEmail: async (notification: EmailNotification): Promise<{ success: boolean; error?: string }> => {
    // This would call your backend email service
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    
    if (!API_BASE_URL) {
      console.warn('Email notifications not configured - no API URL');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/notifications/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      return { success: true };
    } catch (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};
