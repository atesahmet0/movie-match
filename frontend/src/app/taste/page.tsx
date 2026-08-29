import { redirect } from "next/navigation";

interface TastePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TastePage({ searchParams }: TastePageProps) {
  const resolvedParams = await searchParams;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedParams)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    }
  }

  const queryStr = params.toString();
  redirect(queryStr ? `/?${queryStr}` : "/");
}
