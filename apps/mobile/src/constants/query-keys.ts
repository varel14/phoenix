/** React Query cache keys. */
export const queryKeys = {
  songs: (params?: unknown) => ["songs", params ?? {}] as const,
  songSearch: (q: string) => ["songs", "search", q] as const,
  song: (id: string) => ["song", id] as const,

  videos: (params?: unknown) => ["videos", params ?? {}] as const,
  videoSearch: (q: string) => ["videos", "search", q] as const,
  video: (id: string) => ["video", id] as const,

  artists: (params?: unknown) => ["artists", params ?? {}] as const,
  artist: (id: string) => ["artist", id] as const,
  artistSongs: (id: string) => ["artists", id, "songs"] as const,
  artistVideos: (id: string) => ["artists", id, "videos"] as const,
  artistStats: (id: string) => ["artists", id, "stats"] as const,
  following: () => ["following"] as const,

  playlists: () => ["playlists"] as const,
  playlist: (id: string) => ["playlist", id] as const,
  playlistItems: (id: string) => ["playlist", id, "items"] as const,

  favorites: (mediaType?: string) => ["favorites", mediaType ?? "all"] as const,
  favoriteIds: () => ["favorite-ids"] as const,

  downloads: (mediaType?: string) => ["downloads", mediaType ?? "all"] as const,

  subscription: () => ["subscription"] as const,
  subscriptionRoyalties: () => ["subscription-royalties"] as const,
  artistEarnings: () => ["artist-earnings"] as const,

  me: () => ["me"] as const,
  myArtist: () => ["my-artist"] as const,

  conversations: (params?: unknown) => ["conversations", params ?? {}] as const,
  conversation: (id: string) => ["conversation", id] as const,
  messages: (id: string) => ["messages", id] as const,
  callHistory: () => ["call-history"] as const,

  paymentCategories: () => ["payment-categories"] as const,
  paymentServices: (categoryId?: string) => ["payment-services", categoryId ?? "all"] as const,
  paymentService: (id: string) => ["payment-service", id] as const,
  transactions: (status?: string) => ["transactions", status ?? "all"] as const,
  transaction: (id: string) => ["transaction", id] as const,

  products: (params?: unknown) => ["products", params ?? {}] as const,
  product: (id: string) => ["product", id] as const,
  productCategories: () => ["product-categories"] as const,
  cart: () => ["cart"] as const,
  orders: () => ["orders"] as const,
  order: (id: string) => ["order", id] as const,
};
