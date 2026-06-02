declare module "marked" {
  export function parse(src: string, options?: any): string;
  export const marked: {
    parse(src: string, options?: any): string;
  };
}

declare module "prismjs" {
  const Prism: any;
  export default Prism;
}

declare module "prismjs/components/*";
