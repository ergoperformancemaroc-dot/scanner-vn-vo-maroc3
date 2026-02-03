import React from 'react';

export const Button: React.FC<any> = ({ children, variant = 'primary', isLoading, className = '', ...props }) => {
  const base = "flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-xl";
  const variants: any = {
    primary: "bg-blue-600 text-white shadow-blue-500/30 border-t border-white/20 hover:bg-blue-700",
    danger: "bg-red-500 text-white shadow-red-500/20 border-t border-white/20",
    outline: "border-2 border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={isLoading || props.disabled} {...props}>
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          Traitement...
        </span>
      ) : children}
    </button>
  );
};