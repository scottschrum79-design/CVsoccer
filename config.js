window.TEAMSIGNUPS_CONFIG = {
  storageProvider: "supabase",
  previewMode: false,

  // Original production Google Apps Script endpoint, retained only as a fallback.
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbwicKv13R4Nxsx6G_-9eTNZSQqIuEXvNO7Zit3gI2sgUAlSYNVZ4Czd-2feDMRCw6bJ/exec",

  // Public Supabase connection settings. Never place the service-role key here.
  supabaseUrl: "https://haxhggcummwstuhxqyvt.supabase.co",
  supabaseAnonKey: "sb_publishable_gYNV0rQrB35dbILQwRC9vQ_bIge3iYr",
  creatorEmail: "scott@cvsoccer.club",

  // Sends coach and administrator signup confirmation emails.
  emailNotificationUrl: "https://script.google.com/macros/s/AKfycbygmideQBwS8RHGDFp8uk2MYsEVLUauYzc-YZ4TUL7KIdnwuL5oZK7bRcxCVTKBZzfMbQ/exec",

  // Creator access is handled by Supabase Authentication.
  creatorPassword: ""
};
