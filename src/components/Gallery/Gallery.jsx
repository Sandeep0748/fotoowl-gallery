import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { fetchImages } from "../../services/unsplash";
// import ImageCard from "../Gallery/ImageCard";
import ImageCard from "../Gallery/IMageCard";
import ImageModal from "./ImageModal";
import { useUserStore } from "../../store/userStore";

const Gallery = () => {
  const {
    selectedImage,
    isModalOpen,
    setSelectedImage,
    closeModal,
  } = useUserStore();

  const observerRef = useRef(null);

  /* -------------------- QUERY -------------------- */
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ["images"],
    queryFn: ({ pageParam = 1 }) => fetchImages(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage?.length ? pages.length + 1 : undefined,
  });

  const images = data?.pages.flat() ?? [];

  /* -------------------- INFINITE SCROLL -------------------- */
  const lastImageRef = useCallback(
    (node) => {
      if (isFetchingNextPage) return;

      observerRef.current?.disconnect();

      observerRef.current = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, fetchNextPage, hasNextPage]
  );

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  /* -------------------- STATES -------------------- */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading gallery…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Failed to load images
      </div>
    );
  }

  /* -------------------- UI -------------------- */
  return (
    <>
      <div className="p-6 h-full overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-3xl font-semibold text-gray-800">
            Gallery
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Explore and react to images in real time
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((img, index) => (
            <div
              key={img.id}
              ref={index === images.length - 1 ? lastImageRef : null}
            >
              <ImageCard
                image={img}
                onImageClick={() => setSelectedImage(img)}
              />
            </div>
          ))}
        </div>

        {isFetchingNextPage && (
          <div className="mt-8 text-center text-gray-400 animate-pulse">
            Loading more images…
          </div>
        )}

        {!hasNextPage && images.length > 0 && (
          <div className="mt-8 text-center text-gray-400 text-sm">
            You’ve reached the end ✨
          </div>
        )}
      </div>

      {isModalOpen && selectedImage && (
        <ImageModal image={selectedImage} onClose={closeModal} />
      )}
    </>
  );
};

export default Gallery;
