package az.dev.localtube.domain;

public enum VideoVisibility {
    PUBLIC,      // Everyone can view
    PRIVATE,     // Only admin-modtube users can view
    UNLISTED,    // Anyone with link can view, but not in search/listings
    RESTRICTED   // Only specific users can view (whitelist)
}