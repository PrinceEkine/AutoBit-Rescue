
/**
 * WhatsApp Service for handling deep links and API integrations.
 * Note: Video and Voice calls via WhatsApp are handled through deep links 
 * as the official Cloud API only supports messaging and templates.
 */

export const WhatsAppService = {
  /**
   * Generates a Click-to-Chat link
   */
  getChatLink: (phoneNumber: string, message?: string) => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    let url = `https://wa.me/${cleanNumber}`;
    if (message) {
      url += `?text=${encodeURIComponent(message)}`;
    }
    return url;
  },

  /**
   * Generates a deep link for calls. 
   * Note: Deep links for direct calls (voip) work best on mobile.
   */
  getCallLink: (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    return `whatsapp://send?phone=${cleanNumber}`;
  },

  /**
   * For the Cloud API (Messaging), we provide a standard interface.
   * This would typically be a server-side implementation.
   */
  sendMessage: async (to: string, message: string) => {
    console.log(`[WhatsApp API Mock] Sending to ${to}: ${message}`);
    // In a real implementation, this would call /api/whatsapp/send
    return { success: true, messageId: Math.random().toString(36).substring(7) };
  }
};
