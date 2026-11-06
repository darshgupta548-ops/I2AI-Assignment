import React from 'react';
import { BlockMath, InlineMath } from 'react-katex';

export function MathEquation({ tex, block = true, className = '' }: { tex: string; block?: boolean; className?: string }) {
  const renderError = (error: Error) => (
    <span role="alert" className="math-render-error">
      Equation could not be rendered{import.meta.env.DEV ? `: ${error.message}` : '. Please report this equation.'}
    </span>
  );
  return <div className={`math-equation ${block ? 'math-block' : 'math-inline'} ${className}`}>
    {block ? <BlockMath math={tex} errorColor="#b91c1c" renderError={renderError} /> : <InlineMath math={tex} errorColor="#b91c1c" renderError={renderError} />}
  </div>;
}
