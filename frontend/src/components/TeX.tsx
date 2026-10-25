import katex from "katex";
import "katex/dist/katex.min.css";

interface TeXProps {
  expression: string;
}

/**
 * Inline formula typeset from a TeX expression written in the code.
 */
export function TeX({ expression }: TeXProps) {
  return (
    <span
      className="tex"
      dangerouslySetInnerHTML={{ __html: katex.renderToString(expression, { throwOnError: true, output: "html" }) }}
    />
  );
}
