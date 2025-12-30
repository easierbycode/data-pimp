export const translations = {
  'en-US': {
    // Navigation
    nav: {
      samples: 'Samples',
      bundles: 'Bundles',
      checkout: 'Checkout',
      inventory: 'Inventory Manager'
    },
    
    // Common actions
    actions: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      add: 'Add',
      remove: 'Remove',
      search: 'Search',
      filter: 'Filter',
      clear: 'Clear',
      copy: 'Copy',
      copied: 'Copied!',
      checkout: 'Check Out',
      checkin: 'Check In',
      reserve: 'Reserve',
      unreserve: 'Unreserve',
      viewDetails: 'View Details',
      back: 'Back',
      confirm: 'Confirm',
      upload: 'Upload'
    },
    
    // Status labels
    status: {
      available: 'Available',
      checked_out: 'Checked Out',
      reserved: 'Reserved',
      discontinued: 'Discontinued'
    },
    
    // Sample fields
    sample: {
      title: 'Sample',
      titlePlural: 'Samples',
      name: 'Name',
      brand: 'Brand',
      location: 'Location',
      qrCode: 'QR/Barcode',
      picture: 'Picture',
      tiktokLink: 'TikTok Affiliate Link',
      fireSale: 'Fire Sale',
      status: 'Status',
      currentPrice: 'Current Price',
      bestPrice: 'Best Price',
      bestPriceSource: 'Best Price Source',
      lastPriceChecked: 'Last Price Checked',
      checkedOutAt: 'Checked Out At',
      checkedInAt: 'Checked In At',
      checkedOutTo: 'Checked Out To',
      notes: 'Notes',
      bundle: 'Bundle',
      noBundle: 'Not in a bundle',
      createNew: 'New Sample',
      editSample: 'Edit Sample',
      deleteSample: 'Delete Sample',
      deleteConfirm: 'Are you sure you want to delete this sample?',
      notFound: 'Sample not found'
    },
    
    // Bundle fields
    bundle: {
      title: 'Bundle',
      titlePlural: 'Bundles',
      name: 'Name',
      location: 'Location',
      qrCode: 'QR/Barcode',
      notes: 'Notes',
      samples: 'Samples in Bundle',
      sampleCount: 'Sample Count',
      addSample: 'Add Sample',
      removeSample: 'Remove Sample',
      createNew: 'New Bundle',
      editBundle: 'Edit Bundle',
      deleteBundle: 'Delete Bundle',
      deleteConfirm: 'Are you sure you want to delete this bundle?',
      notFound: 'Bundle not found',
      noSamples: 'No samples in this bundle'
    },
    
    // Checkout page
    checkout: {
      title: 'Checkout Station',
      scanPrompt: 'Scan a QR code or barcode to begin',
      scanPlaceholder: 'Scan or enter code here...',
      scanFocus: 'Click here or press any key to focus scanner',
      processing: 'Processing...',
      notFound: 'Code not found',
      notFoundDesc: 'The scanned code does not match any sample or bundle',
      sampleFound: 'Sample Found',
      bundleFound: 'Bundle Found',
      recentScans: 'Recent Scans',
      noRecentScans: 'No recent scans',
      checkoutTo: 'Check out to',
      checkoutToPlaceholder: 'Enter recipient name...',
      checkoutSuccess: 'Successfully checked out',
      checkinSuccess: 'Successfully checked in',
      reserveSuccess: 'Successfully reserved',
      bundleCheckoutSuccess: 'Bundle checked out successfully',
      bundleCheckinSuccess: 'Bundle checked in successfully',
      eligibleSamples: 'Eligible Samples',
      allSamples: 'All Samples in Bundle'
    },
    
    // Transaction actions
    transaction: {
      checkout: 'Checkout',
      checkin: 'Check-in',
      reserve: 'Reserve',
      unreserve: 'Unreserve'
    },
    
    // Filters
    filters: {
      all: 'All',
      allBrands: 'All Brands',
      allLocations: 'All Locations',
      allStatuses: 'All Statuses',
      fireSaleOnly: 'Fire Sale Only',
      searchPlaceholder: 'Search by name, brand, or code...',
      filterByStatus: 'Filter by status...',
      fireSale: 'Fire Sale',
      lowestPrice: 'Lowest Price Online'
    },
    
    // Messages
    messages: {
      loading: 'Loading...',
      saving: 'Saving...',
      error: 'An error occurred',
      success: 'Success',
      noResults: 'No results found',
      required: 'This field is required',
      invalidUrl: 'Please enter a valid URL',
      duplicateCode: 'This code is already in use'
    },
    
    // Badges
    badges: {
      fireSale: '🔥 Fire Sale',
      inBundle: 'In Bundle'
    }
  }
};

export const useTranslation = (locale = 'en-US') => {
  const t = (key) => {
    const keys = key.split('.');
    let value = translations[locale];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };
  return { t };
}