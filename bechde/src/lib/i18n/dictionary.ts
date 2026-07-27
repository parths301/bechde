export type Language = "en" | "hi";

export const translations = {
  en: {
    // Navigation / Header
    nav_home: "Home",
    nav_map: "Radar",
    nav_sell: "Sell",
    nav_chat: "Chats",
    nav_profile: "Profile",
    nav_search_placeholder: "Search electronics, furniture, books...",
    
    // Header / Badges
    tagline: "good stuff, walking distance",
    tagline_sub: "Resale marketplace for your neighbourhood",
    
    // Common Actions
    action_sell: "Sell an item",
    action_chat: "Chat with seller",
    action_make_offer: "Make an offer",
    action_save: "Save listing",
    action_saved: "Saved",
    action_report: "Report",
    action_block: "Block user",
    action_filter: "Filter",
    action_clear: "Clear all",
    action_apply: "Apply filters",
    action_back: "Back",
    action_close: "Close",
    action_submit: "Submit",
    action_cancel: "Cancel",
    
    // Status
    status_available: "Available",
    status_reserved: "Reserved",
    status_sold: "Sold",
    
    // Categories
    cat_all: "All Items",
    cat_electronics: "Electronics",
    cat_furniture: "Furniture",
    cat_appliances: "Appliances",
    cat_fashion: "Fashion",
    cat_books: "Books & Hobbies",
    cat_vehicles: "Vehicles",
    cat_other: "Other",

    // Profile & Trust
    member_since: "Member since",
    verified_seller: "Verified Seller",
    rating: "Rating",
    reviews: "reviews",
    response_time: "Typically responds in",
    
    // Footer / Legal
    privacy_policy: "Privacy Policy",
    terms_of_service: "Terms of Service",
    prohibited_items: "Prohibited Items",
    grievance_contact: "Grievance Contact",
    
    // Distance / Location
    nearby: "nearby",
    km_away: "km away",
    location_current: "Your Location",
  },
  hi: {
    // Navigation / Header
    nav_home: "होम",
    nav_map: "राडार",
    nav_sell: "बेचें",
    nav_chat: "चैट",
    nav_profile: "प्रोफाइल",
    nav_search_placeholder: "इलेक्ट्रॉनिक्स, फर्नीचर, किताबें खोजें...",
    
    // Header / Badges
    tagline: "बढ़िया सामान, पास में",
    tagline_sub: "आपके पड़ोस के लिए रीसेल मार्केटप्लेस",
    
    // Common Actions
    action_sell: "सामान बेचें",
    action_chat: "विक्रेता से बात करें",
    action_make_offer: "ऑफर दें",
    action_save: "सेव करें",
    action_saved: "सेव किया गया",
    action_report: "रिपोर्ट करें",
    action_block: "ब्लॉक करें",
    action_filter: "फ़िल्टर",
    action_clear: "सब हटाएं",
    action_apply: "फ़िल्टर लागू करें",
    action_back: "वापस",
    action_close: "बंद करें",
    action_submit: "जमा करें",
    action_cancel: "रद्द करें",
    
    // Status
    status_available: "उपलब्ध",
    status_reserved: "बुक किया गया",
    status_sold: "बिक गया",
    
    // Categories
    cat_all: "सभी सामान",
    cat_electronics: "इलेक्ट्रॉनिक्स",
    cat_furniture: "फर्नीचर",
    cat_appliances: "उपकरण",
    cat_fashion: "फैशन",
    cat_books: "किताबें और शौक",
    cat_vehicles: "वाहन",
    cat_other: "अन्य",

    // Profile & Trust
    member_since: "सदस्यता तिथि",
    verified_seller: "सत्यापित विक्रेता",
    rating: "रेटिंग",
    reviews: "समीक्षाएं",
    response_time: "आमतौर पर जवाब देता है",
    
    // Footer / Legal
    privacy_policy: "गोपनीयता नीति",
    terms_of_service: "सेवा की शर्तें",
    prohibited_items: "प्रतिबंधित वस्तुएं",
    grievance_contact: "शिकायत संपर्क",
    
    // Distance / Location
    nearby: "पास में",
    km_away: "किमी दूर",
    location_current: "आपकी लोकेशन",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
