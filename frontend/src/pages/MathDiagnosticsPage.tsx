import { MathEquation } from '../components/MathEquation';

const groups = [
  { name: 'Linear Regression', formulas: [String.raw`\hat{y}=\beta_0+\beta_1x`, String.raw`\mathrm{SSE}=\sum_{i=1}^{n}(y_i-\hat{y}_i)^2`, String.raw`e_i=y_i-\hat{y}_i`] },
  { name: 'Decision Tree', formulas: [String.raw`\mathrm{Gini}=1-\sum_{c=1}^{C}p_c^2`, String.raw`H=-\sum_{c=1}^{C}p_c\log_2(p_c)`] },
  { name: 'K-Means', formulas: [String.raw`d(x_i,\mu_k)=\sqrt{\sum_{j=1}^{p}(x_{ij}-\mu_{kj})^2}`, String.raw`J=\sum_{k=1}^{K}\sum_{x_i\in C_k}\lVert x_i-\mu_k\rVert^2`] },
  { name: 'PCA', formulas: [String.raw`z_j=\frac{x_j-\mu_j}{\sigma_j}`, String.raw`\mathrm{EVR}_i=\frac{\lambda_i}{\sum_{j=1}^{p}\lambda_j}`, String.raw`v_1=\operatorname*{arg\,max}_{\lVert v\rVert=1}v^{\mathsf T}\Sigma v`] },
];

export function MathDiagnosticsPage() {
  return <main className="max-w-4xl mx-auto p-8 space-y-6"><header><p className="text-xs uppercase tracking-widest">Development diagnostics</p><h1 className="text-3xl font-bold">Math rendering checks</h1><p>Representative formulas verify symbols, fractions, roots, norms, optimization, subscripts, and superscripts.</p></header>{groups.map(group => <section key={group.name} className="clay-card p-6"><h2 className="font-bold text-xl">{group.name}</h2><div className="space-y-3">{group.formulas.map(formula => <MathEquation key={formula} tex={formula} />)}</div></section>)}</main>;
}
