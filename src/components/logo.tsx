import type { ImgHTMLAttributes } from "react";

export function Logo(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} src="/favicon.ico" />;
}
