/** an alias for the localstorage object */
export const storage = {
  set: (key: string, value: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  },
  get: (key: string) => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(key);
    }
  },
  remove: (key: string) => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
  },
} satisfies {
  /** sets the item */
  set: (key: string, value: string) => void;
  /** returns the item */
  get: (key: string) => string | null | undefined;
  /** removes the item */
  remove: (key: string) => void;
};
