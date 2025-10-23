interface EmailTranslations {
  subject: string;
  greeting?: string;
  body1?: string;
  body2?: string;
  body3?: string;
  buttonText?: string;
  expiryText?: string;
  securityNote?: string;
  closing?: string;
  team?: string;
  disclaimer?: string;
  
  // Invoice specific
  invoiceTitle?: string;
  invoiceDate?: string;
  customerDetails?: string;
  item?: string;
  price?: string;
  subtotal?: string;
  total?: string;
  paymentMethod?: string;
  paidVia?: string;
  thankYou?: string;
  visitWebsite?: string;
  
  // Print order specific
  printOrderTitle?: string;
  printThankYou?: string;
  printBody1?: string;
  printBody2?: string;
  printNotification?: string;
  
  // Digital/Print edition labels
  digitalEdition?: string;
  printEdition?: string;
}

interface EmailTypeTranslations {
  [language: string]: EmailTranslations;
}

interface AllEmailTranslations {
  passwordReset: EmailTypeTranslations;
  printPurchase: EmailTypeTranslations;
  invoice: EmailTypeTranslations;
  orderCancelled: EmailTypeTranslations;
}

const translations: AllEmailTranslations = {
  passwordReset: {
    en: {
      subject: 'Reset Your Password - AI Storybook Builder',
      greeting: 'Hi {name},',
      body1: 'We received a request to reset your password for your AI Storybook Builder account. Click the button below to reset your password:',
      buttonText: 'Reset Password',
      expiryText: 'This link will expire in <strong>1 hour</strong> for security reasons.',
      securityNote: "If you didn't request a password reset, please ignore this email or contact support if you have concerns.",
      closing: 'Best regards,',
      team: 'AI Storyteller Team',
      disclaimer: 'This is an automated email. Please do not reply to this email.',
    },
    es: {
      subject: 'Restablece tu Contraseña - Constructor de Libros de Cuentos AI',
      greeting: 'Hola {name},',
      body1: 'Recibimos una solicitud para restablecer tu contraseña de tu cuenta de Constructor de Libros de Cuentos AI. Haz clic en el botón a continuación para restablecer tu contraseña:',
      buttonText: 'Restablecer Contraseña',
      expiryText: 'Este enlace expirará en <strong>1 hora</strong> por razones de seguridad.',
      securityNote: 'Si no solicitaste restablecer tu contraseña, ignora este correo o contacta a soporte si tienes dudas.',
      closing: 'Saludos cordiales,',
      team: 'Equipo AI Storyteller',
      disclaimer: 'Este es un correo automatizado. Por favor, no respondas a este correo.',
    },
    fr: {
      subject: 'Réinitialisez Votre Mot de Passe - Créateur de Livres AI',
      greeting: 'Bonjour {name},',
      body1: "Nous avons reçu une demande de réinitialisation de votre mot de passe pour votre compte Créateur de Livres AI. Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :",
      buttonText: 'Réinitialiser le Mot de Passe',
      expiryText: 'Ce lien expirera dans <strong>1 heure</strong> pour des raisons de sécurité.',
      securityNote: "Si vous n'avez pas demandé de réinitialisation de mot de passe, veuillez ignorer cet e-mail ou contacter le support si vous avez des préoccupations.",
      closing: 'Cordialement,',
      team: 'Équipe AI Storyteller',
      disclaimer: 'Ceci est un e-mail automatisé. Veuillez ne pas répondre à cet e-mail.',
    },
    de: {
      subject: 'Passwort Zurücksetzen - AI Geschichtenbuch-Generator',
      greeting: 'Hallo {name},',
      body1: 'Wir haben eine Anfrage erhalten, Ihr Passwort für Ihr AI Geschichtenbuch-Generator-Konto zurückzusetzen. Klicken Sie auf die Schaltfläche unten, um Ihr Passwort zurückzusetzen:',
      buttonText: 'Passwort Zurücksetzen',
      expiryText: 'Dieser Link läuft aus Sicherheitsgründen in <strong>1 Stunde</strong> ab.',
      securityNote: 'Wenn Sie keine Passwort-Zurücksetzung angefordert haben, ignorieren Sie diese E-Mail oder kontaktieren Sie den Support, wenn Sie Bedenken haben.',
      closing: 'Mit freundlichen Grüßen,',
      team: 'AI Storyteller Team',
      disclaimer: 'Dies ist eine automatische E-Mail. Bitte antworten Sie nicht auf diese E-Mail.',
    },
    zh: {
      subject: '重置您的密码 - AI故事书生成器',
      greeting: '您好 {name}，',
      body1: '我们收到了重置您的AI故事书生成器账户密码的请求。请点击下面的按钮重置您的密码：',
      buttonText: '重置密码',
      expiryText: '出于安全考虑，此链接将在<strong>1小时</strong>后失效。',
      securityNote: '如果您没有请求重置密码，请忽略此邮件，如有疑问请联系客服。',
      closing: '此致敬礼，',
      team: 'AI Storyteller 团队',
      disclaimer: '这是一封自动发送的邮件，请勿回复此邮件。',
    },
  },
  
  printPurchase: {
    en: {
      subject: 'Your Print Order - {title}',
      printOrderTitle: 'Your Print Order - {title}',
      printThankYou: 'Thank you for your print order!',
      printBody1: 'While we finalize our printing partnership, please enjoy this digital PDF version of <strong>"{title}"</strong>. Your PDF is attached to this email.',
      printNotification: "We'll notify you as soon as physical printing becomes available!",
      closing: 'Best regards,',
      team: 'AI Storyteller Team',
      disclaimer: 'This is an automated email. Please do not reply to this email.',
    },
    es: {
      subject: 'Tu Pedido de Impresión - {title}',
      printOrderTitle: 'Tu Pedido de Impresión - {title}',
      printThankYou: '¡Gracias por tu pedido de impresión!',
      printBody1: 'Mientras finalizamos nuestra asociación de impresión, disfruta de esta versión PDF digital de <strong>"{title}"</strong>. Tu PDF está adjunto a este correo.',
      printNotification: '¡Te notificaremos tan pronto como la impresión física esté disponible!',
      closing: 'Saludos cordiales,',
      team: 'Equipo AI Storyteller',
      disclaimer: 'Este es un correo automatizado. Por favor, no respondas a este correo.',
    },
    fr: {
      subject: 'Votre Commande Imprimée - {title}',
      printOrderTitle: 'Votre Commande Imprimée - {title}',
      printThankYou: 'Merci pour votre commande imprimée !',
      printBody1: 'Pendant que nous finalisons notre partenariat d\'impression, profitez de cette version PDF numérique de <strong>"{title}"</strong>. Votre PDF est joint à cet e-mail.',
      printNotification: 'Nous vous informerons dès que l\'impression physique sera disponible !',
      closing: 'Cordialement,',
      team: 'Équipe AI Storyteller',
      disclaimer: 'Ceci est un e-mail automatisé. Veuillez ne pas répondre à cet e-mail.',
    },
    de: {
      subject: 'Ihre Druckbestellung - {title}',
      printOrderTitle: 'Ihre Druckbestellung - {title}',
      printThankYou: 'Vielen Dank für Ihre Druckbestellung!',
      printBody1: 'Während wir unsere Druckpartnerschaft abschließen, genießen Sie bitte diese digitale PDF-Version von <strong>"{title}"</strong>. Ihr PDF ist dieser E-Mail beigefügt.',
      printNotification: 'Wir werden Sie benachrichtigen, sobald der physische Druck verfügbar ist!',
      closing: 'Mit freundlichen Grüßen,',
      team: 'AI Storyteller Team',
      disclaimer: 'Dies ist eine automatische E-Mail. Bitte antworten Sie nicht auf diese E-Mail.',
    },
    zh: {
      subject: '您的打印订单 - {title}',
      printOrderTitle: '您的打印订单 - {title}',
      printThankYou: '感谢您的打印订单！',
      printBody1: '在我们完成打印合作的同时，请先享受这个<strong>《{title}》</strong>的数字PDF版本。PDF文件已附在此邮件中。',
      printNotification: '一旦实体打印可用，我们会立即通知您！',
      closing: '此致敬礼，',
      team: 'AI Storyteller 团队',
      disclaimer: '这是一封自动发送的邮件，请勿回复此邮件。',
    },
  },
  
  invoice: {
    en: {
      subject: 'Invoice #{invoiceNumber} - Thank you for your purchase',
      invoiceTitle: 'INVOICE',
      invoiceDate: 'Invoice Date',
      customerDetails: 'Customer Details',
      item: 'Item',
      price: 'Price',
      subtotal: 'Subtotal',
      total: 'Total',
      paymentMethod: 'Payment Method',
      paidVia: 'Paid via Stripe',
      thankYou: 'Thank you for your purchase!',
      visitWebsite: 'Visit our website:',
      disclaimer: 'This is an automated invoice. Please do not reply to this email.',
      digitalEdition: 'Digital Edition',
      printEdition: 'Print Edition',
    },
    es: {
      subject: 'Factura #{invoiceNumber} - Gracias por tu compra',
      invoiceTitle: 'FACTURA',
      invoiceDate: 'Fecha de Factura',
      customerDetails: 'Detalles del Cliente',
      item: 'Artículo',
      price: 'Precio',
      subtotal: 'Subtotal',
      total: 'Total',
      paymentMethod: 'Método de Pago',
      paidVia: 'Pagado vía Stripe',
      thankYou: '¡Gracias por tu compra!',
      visitWebsite: 'Visita nuestro sitio web:',
      disclaimer: 'Esta es una factura automatizada. Por favor, no respondas a este correo.',
      digitalEdition: 'Edición Digital',
      printEdition: 'Edición Impresa',
    },
    fr: {
      subject: 'Facture #{invoiceNumber} - Merci pour votre achat',
      invoiceTitle: 'FACTURE',
      invoiceDate: 'Date de Facture',
      customerDetails: 'Détails du Client',
      item: 'Article',
      price: 'Prix',
      subtotal: 'Sous-total',
      total: 'Total',
      paymentMethod: 'Méthode de Paiement',
      paidVia: 'Payé via Stripe',
      thankYou: 'Merci pour votre achat !',
      visitWebsite: 'Visitez notre site web :',
      disclaimer: 'Ceci est une facture automatisée. Veuillez ne pas répondre à cet e-mail.',
      digitalEdition: 'Édition Numérique',
      printEdition: 'Édition Imprimée',
    },
    de: {
      subject: 'Rechnung #{invoiceNumber} - Vielen Dank für Ihren Einkauf',
      invoiceTitle: 'RECHNUNG',
      invoiceDate: 'Rechnungsdatum',
      customerDetails: 'Kundendetails',
      item: 'Artikel',
      price: 'Preis',
      subtotal: 'Zwischensumme',
      total: 'Gesamt',
      paymentMethod: 'Zahlungsmethode',
      paidVia: 'Bezahlt über Stripe',
      thankYou: 'Vielen Dank für Ihren Einkauf!',
      visitWebsite: 'Besuchen Sie unsere Website:',
      disclaimer: 'Dies ist eine automatische Rechnung. Bitte antworten Sie nicht auf diese E-Mail.',
      digitalEdition: 'Digitale Ausgabe',
      printEdition: 'Druckausgabe',
    },
    zh: {
      subject: '发票 #{invoiceNumber} - 感谢您的购买',
      invoiceTitle: '发票',
      invoiceDate: '发票日期',
      customerDetails: '客户详情',
      item: '项目',
      price: '价格',
      subtotal: '小计',
      total: '总计',
      paymentMethod: '支付方式',
      paidVia: '通过 Stripe 支付',
      thankYou: '感谢您的购买！',
      visitWebsite: '访问我们的网站：',
      disclaimer: '这是一封自动发送的发票邮件，请勿回复此邮件。',
      digitalEdition: '数字版',
      printEdition: '印刷版',
    },
  },

  orderCancelled: {
    en: {
      subject: 'Order Cancelled - {title}',
      greeting: 'Hi {name},',
      body1: 'We regret to inform you that your print order for <strong>"{title}"</strong> has been automatically cancelled due to a technical issue.',
      body2: '<strong>Reason:</strong> Our printing partner was unable to download the print-ready files. This can happen when URLs expire or there are temporary connectivity issues.',
      body3: '<strong>Refund:</strong> A full refund has been automatically processed to your original payment method. You should see it within 5-10 business days.',
      closing: 'We apologize for the inconvenience,',
      team: 'AI Storyteller Team',
      disclaimer: 'If you have any questions, please contact support.',
    },
    es: {
      subject: 'Pedido Cancelado - {title}',
      greeting: 'Hola {name},',
      body1: 'Lamentamos informarte que tu pedido de impresión de <strong>"{title}"</strong> ha sido cancelado automáticamente debido a un problema técnico.',
      body2: '<strong>Motivo:</strong> Nuestro socio de impresión no pudo descargar los archivos listos para imprimir. Esto puede suceder cuando las URLs expiran o hay problemas temporales de conectividad.',
      body3: '<strong>Reembolso:</strong> Se ha procesado automáticamente un reembolso completo a tu método de pago original. Deberías verlo dentro de 5-10 días hábiles.',
      closing: 'Pedimos disculpas por las molestias,',
      team: 'Equipo AI Storyteller',
      disclaimer: 'Si tienes alguna pregunta, contáctanos.',
    },
    fr: {
      subject: 'Commande Annulée - {title}',
      greeting: 'Bonjour {name},',
      body1: 'Nous regrettons de vous informer que votre commande d\'impression pour <strong>"{title}"</strong> a été automatiquement annulée en raison d\'un problème technique.',
      body2: '<strong>Raison :</strong> Notre partenaire d\'impression n\'a pas pu télécharger les fichiers prêts à imprimer. Cela peut se produire lorsque les URLs expirent ou qu\'il y a des problèmes de connectivité temporaires.',
      body3: '<strong>Remboursement :</strong> Un remboursement complet a été traité automatiquement vers votre méthode de paiement d\'origine. Vous devriez le voir dans les 5 à 10 jours ouvrables.',
      closing: 'Nous nous excusons pour la gêne occasionnée,',
      team: 'Équipe AI Storyteller',
      disclaimer: 'Si vous avez des questions, veuillez contacter le support.',
    },
    de: {
      subject: 'Bestellung Storniert - {title}',
      greeting: 'Hallo {name},',
      body1: 'Wir bedauern, Ihnen mitteilen zu müssen, dass Ihre Druckbestellung für <strong>"{title}"</strong> aufgrund eines technischen Problems automatisch storniert wurde.',
      body2: '<strong>Grund:</strong> Unser Druckpartner konnte die druckfertigen Dateien nicht herunterladen. Dies kann passieren, wenn URLs ablaufen oder temporäre Verbindungsprobleme auftreten.',
      body3: '<strong>Rückerstattung:</strong> Eine vollständige Rückerstattung wurde automatisch auf Ihre ursprüngliche Zahlungsmethode verarbeitet. Sie sollten sie innerhalb von 5-10 Werktagen sehen.',
      closing: 'Wir entschuldigen uns für die Unannehmlichkeiten,',
      team: 'AI Storyteller Team',
      disclaimer: 'Wenn Sie Fragen haben, wenden Sie sich bitte an den Support.',
    },
    zh: {
      subject: '订单已取消 - {title}',
      greeting: '您好 {name}，',
      body1: '很遗憾地通知您，您对<strong>"{title}"</strong>的印刷订单因技术问题已被自动取消。',
      body2: '<strong>原因：</strong>我们的印刷合作伙伴无法下载打印文件。这可能发生在URL过期或存在临时连接问题时。',
      body3: '<strong>退款：</strong>已自动处理全额退款至您原始的支付方式。您应该在5-10个工作日内看到退款。',
      closing: '对于造成的不便，我们深表歉意，',
      team: 'AI Storyteller 团队',
      disclaimer: '如有任何问题，请联系客服。',
    },
  },
};

export function getEmailTranslations(
  language: string,
  emailType: 'passwordReset' | 'printPurchase' | 'invoice' | 'orderCancelled'
): EmailTranslations {
  // Normalize language code to 2-letter code
  const normalizedLang = language.toLowerCase().substring(0, 2);
  
  // Get translations for the email type
  const typeTranslations = translations[emailType];
  
  // Return translations for the language, fallback to English if not found
  return typeTranslations[normalizedLang] || typeTranslations['en'];
}

// Helper function to replace placeholders in text
export function replacePlaceholders(
  text: string,
  placeholders: { [key: string]: string | number }
): string {
  let result = text;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}
