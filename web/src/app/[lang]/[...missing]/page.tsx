import { notFound } from "next/navigation";

/** The proxy sends every address under a language, so unknown ones end here: 404 inside the site layout. */
export default function MissingPage() {
  notFound();
}
