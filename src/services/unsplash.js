const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_KEY;

export const fetchImages = async (page = 1, perPage = 12) => {
  // If no API key, use Unsplash demo mode (limited but works)
  const accessKey = UNSPLASH_ACCESS_KEY || "demo";
  const url = `https://api.unsplash.com/photos?page=${page}&per_page=${perPage}&order_by=latest&client_id=${accessKey}`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      // Fallback to Picsum if Unsplash fails
      if (!UNSPLASH_ACCESS_KEY || res.status === 401) {
        console.warn("Using Picsum fallback");
        return fetchPicsumImages(page, perPage);
      }
      throw new Error(`Failed to load images: ${res.status}`);
    }

    const data = await res.json();
    return data.map((img) => ({
      id: img.id,
      urls: {
        small: img.urls.small,
        regular: img.urls.regular,
        full: img.urls.full,
      },
      alt_description: img.alt_description || img.description || "Unsplash photo",
      user: {
        name: img.user.name,
        username: img.user.username,
      },
    }));
  } catch (error) {
    console.error("Unsplash fetch error:", error);
    // Fallback to Picsum
    return fetchPicsumImages(page, perPage);
  }
};

// Fallback function using Picsum
const fetchPicsumImages = async (page = 1, limit = 12) => {
  const res = await fetch(
    `https://picsum.photos/v2/list?page=${page}&limit=${limit}`
  );

  if (!res.ok) {
    throw new Error("Failed to load images");
  }

  const data = await res.json();
  return data.map((img) => ({
    id: img.id,
    urls: {
      small: img.download_url,
      regular: img.download_url,
      full: img.download_url,
    },
    alt_description: `Photo by ${img.author}`,
    user: {
      name: img.author,
      username: img.author.toLowerCase().replace(/\s+/g, ""),
    },
  }));
};
