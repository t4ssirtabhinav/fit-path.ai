import React from 'react';

export function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="text-sm font-medium text-gray-300 block mb-2">
      {children}
      {optional && <span className="text-xs text-gray-600 font-normal ml-1">(optional)</span>}
    </label>
  );
}
