import React from 'react';
import { useFinance } from '../context/FinanceContext';

interface BlurValueProps {
  children: React.ReactNode;
  className?: string;
  isBlur?: boolean;
}

export const BlurValue: React.FC<BlurValueProps> = ({
  children,
  className = '',
  isBlur,
}) => {
  const { isFocusMode } = useFinance();
  const shouldBlur = isBlur !== undefined ? isBlur : isFocusMode;

  if (!shouldBlur) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span
      className={`inline-block filter blur-[7px] select-none transition-all duration-300 hover:blur-none active:blur-none cursor-pointer group-hover:blur-none ${className}`}
      title="Modo Foco ativo: passe o mouse ou toque para espiar"
    >
      {children}
    </span>
  );
};
