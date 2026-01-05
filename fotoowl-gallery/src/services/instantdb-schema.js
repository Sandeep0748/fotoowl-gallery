// InstantDB Schema Definition
// This defines the collections and their structure for the fotoowl-gallery app
// Note: InstantDB uses a schemaless approach, but we define the expected structure here for clarity

export const instantDBSchema = {
  // Images collection - not stored in DB, fetched from Unsplash
  // But we reference images by their Unsplash ID

  // Reactions collection
  reactions: {
    imageId: "string", // Unsplash image ID
    emoji: "string",   // The emoji reacted with
    userId: "string",  // Unique user identifier
    username: "string", // Display name
    createdAt: "number", // Timestamp
  },

  // Comments collection
  comments: {
    imageId: "string", // Unsplash image ID
    text: "string",    // Comment content
    userId: "string",  // Unique user identifier
    username: "string", // Display name
    createdAt: "number", // Timestamp
  },

  // FeedEvents collection (referred to as 'feed' in queries)
  feed: {
    type: "string",    // "reaction" or "comment"
    imageId: "string", // Unsplash image ID
    emoji: "string",   // For reactions
    text: "string",    // For comments
    reactionId: "string", // For reactions
    commentId: "string", // For comments
    userId: "string",  // Unique user identifier
    username: "string", // Display name
    createdAt: "number", // Timestamp
  },
};

// Usage in queries:
// db.useQuery({
//   reactions: { where: { imageId: "some-id" } },
//   comments: { where: { imageId: "some-id" } },
//   feed: { $: { order: { createdAt: "desc" } } },
// })

// Transactions:
// db.transact([
//   db.tx.reactions[id].update({ ... }),
//   db.tx.feed[id].update({ ... }),
// ])