// resources/js/hooks/useCategories.ts
import { useEffect, useState } from "react";
import {
  getCategoryLarges,
  getCategoryMiddles,
  getCategorySmalls,
} from "../api/client";
import type {
  CategoryLarge,
  CategoryMiddle,
  CategorySmall,
} from "../api/client";

type UseCategoriesResult = {
  categoryLarges: CategoryLarge[];
  categoryMiddles: CategoryMiddle[];
  categorySmalls: CategorySmall[];
  loading: boolean;
  error: string | null;
};

export function useCategories(): UseCategoriesResult {
  const [categoryLarges, setCategoryLarges] = useState<CategoryLarge[]>([]);
  const [categoryMiddles, setCategoryMiddles] = useState<CategoryMiddle[]>([]);
  const [categorySmalls, setCategorySmalls] = useState<CategorySmall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      setError(null);
      try {
        const [larges, middles, smalls] = await Promise.all([
          getCategoryLarges(),
          getCategoryMiddles(),
          getCategorySmalls(),
        ]);

        setCategoryLarges(larges);
        setCategoryMiddles(middles);
        setCategorySmalls(smalls);

        console.log("DEBUG categoryLarges =", larges);
        console.log("DEBUG categoryMiddles =", middles);
        console.log("DEBUG categorySmalls =", smalls);
      } catch (e) {
        console.error("カテゴリ取得に失敗しました", e);
        setError("カテゴリ取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    void fetchCategories();
  }, []);

  return {
    categoryLarges,
    categoryMiddles,
    categorySmalls,
    loading,
    error,
  };
}
