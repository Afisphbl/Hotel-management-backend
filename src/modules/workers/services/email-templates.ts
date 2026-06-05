export interface PaymentReminderData {
  ownerName: string;
  hotelName: string;
  amount: number;
  currency: string;
  dueDate: string;
  reminderNumber: number;
  payUrl: string;
}

export interface PaymentConfirmedData {
  ownerName: string;
  hotelName: string;
  amount: number;
  currency: string;
  period: string;
}

export interface AccountSuspendedData {
  ownerName: string;
  hotelName: string;
  amount: number;
  currency: string;
  payUrl: string;
}

export interface AccountReactivatedData {
  ownerName: string;
  hotelName: string;
  dashboardUrl?: string;
}

function wrapLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;background-color:#ffffff;">
    <tr>
      <td style="padding:32px 24px 16px;text-align:center;background-color:#0F1B2D;">
        <h1 style="color:#C9973A;margin:0;font-size:24px;font-family:Georgia,serif;">Hotel Booking Platform</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 24px;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;text-align:center;background-color:#f8f7f4;color:#666;font-size:12px;">
        <p style="margin:0 0 4px;">Hotel Booking Platform — Multitenant Hotel Management System</p>
        <p style="margin:0;">If you have any questions, please contact your platform administrator.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function paymentReminderTemplate(data: PaymentReminderData): string {
  const urgencyColor = data.reminderNumber === 2 ? '#dc2626' : '#0F1B2D';
  const urgencyText = data.reminderNumber === 2
    ? 'This is your second reminder. Your account will be suspended if payment is not received by day 3.'
    : 'Please make your payment to keep your account active.';

  return wrapLayout('Payment Reminder', `
    <h2 style="color:#0F1B2D;margin:0 0 16px;font-family:Georgia,serif;">Payment Reminder</h2>
    <p style="color:#444;line-height:1.6;">Dear ${data.ownerName},</p>
    <p style="color:#444;line-height:1.6;">This is a reminder that your monthly subscription payment for <strong>${data.hotelName}</strong> is due.</p>
    <table role="presentation" style="width:100%;margin:24px 0;background-color:#f8f7f4;border-radius:8px;">
      <tr>
        <td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Amount Due</p>
          <p style="margin:0;font-size:28px;font-weight:bold;color:${urgencyColor};">${data.amount.toFixed(2)} ${data.currency}</p>
          <p style="margin:4px 0 0;color:#666;font-size:12px;">Due: ${data.dueDate}</p>
        </td>
      </tr>
    </table>
    <p style="color:#444;line-height:1.6;">${urgencyText}</p>
    <table role="presentation" style="width:100%;margin:24px 0;">
      <tr>
        <td style="text-align:center;">
          <a href="${data.payUrl}" style="display:inline-block;padding:14px 32px;background-color:#C9973A;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Pay Now</a>
        </td>
      </tr>
    </table>
    <p style="color:#888;font-size:13px;line-height:1.5;">If you have already made the payment, please disregard this message. It may take up to 24 hours for the payment to be reflected in your account.</p>
  `);
}

export function paymentConfirmedTemplate(data: PaymentConfirmedData): string {
  return wrapLayout('Payment Confirmed', `
    <h2 style="color:#0F1B2D;margin:0 0 16px;font-family:Georgia,serif;">Payment Confirmed ✅</h2>
    <p style="color:#444;line-height:1.6;">Dear ${data.ownerName},</p>
    <p style="color:#444;line-height:1.6;">Thank you! Your monthly subscription payment for <strong>${data.hotelName}</strong> has been confirmed.</p>
    <table role="presentation" style="width:100%;margin:24px 0;background-color:#f0fdf4;border-radius:8px;">
      <tr>
        <td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Amount Paid</p>
          <p style="margin:0;font-size:28px;font-weight:bold;color:#16a34a;">${data.amount.toFixed(2)} ${data.currency}</p>
          <p style="margin:4px 0 0;color:#666;font-size:12px;">Period: ${data.period}</p>
        </td>
      </tr>
    </table>
    <p style="color:#444;line-height:1.6;">Your account is active and all services are available.</p>
  `);
}

export function accountSuspendedTemplate(data: AccountSuspendedData): string {
  return wrapLayout('Account Suspended', `
    <h2 style="color:#dc2626;margin:0 0 16px;font-family:Georgia,serif;">Account Suspended ⚠️</h2>
    <p style="color:#444;line-height:1.6;">Dear ${data.ownerName},</p>
    <p style="color:#444;line-height:1.6;">Your account for <strong>${data.hotelName}</strong> has been suspended due to non-payment of the monthly subscription fee.</p>
    <table role="presentation" style="width:100%;margin:24px 0;background-color:#fef2f2;border-radius:8px;">
      <tr>
        <td style="padding:16px;text-align:center;">
          <p style="margin:0 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Outstanding Amount</p>
          <p style="margin:0;font-size:28px;font-weight:bold;color:#dc2626;">${data.amount.toFixed(2)} ${data.currency}</p>
        </td>
      </tr>
    </table>
    <p style="color:#444;line-height:1.6;">The following features are currently disabled:</p>
    <ul style="color:#444;line-height:1.8;">
      <li>Dashboard and reporting access</li>
      <li>Guest booking management</li>
      <li>Staff and room management</li>
      <li>Payment processing</li>
    </ul>
    <table role="presentation" style="width:100%;margin:24px 0;">
      <tr>
        <td style="text-align:center;">
          <a href="${data.payUrl}" style="display:inline-block;padding:14px 32px;background-color:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Pay Now to Reactivate</a>
        </td>
      </tr>
    </table>
  `);
}

export function accountReactivatedTemplate(data: AccountReactivatedData): string {
  return wrapLayout('Account Reactivated', `
    <h2 style="color:#16a34a;margin:0 0 16px;font-family:Georgia,serif;">Account Reactivated ✅</h2>
    <p style="color:#444;line-height:1.6;">Dear ${data.ownerName},</p>
    <p style="color:#444;line-height:1.6;">Your account for <strong>${data.hotelName}</strong> has been reactivated. All services are now available.</p>
    <p style="color:#444;line-height:1.6;">You can log in and resume managing your hotel.</p>
    <table role="presentation" style="width:100%;margin:24px 0;">
      <tr>
        <td style="text-align:center;">
          <a href="${data.dashboardUrl || '#'}" style="display:inline-block;padding:14px 32px;background-color:#0F1B2D;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Go to Dashboard</a>
        </td>
      </tr>
    </table>
  `);
}
