import React, { createContext, useState, ReactNode } from 'react';

interface EditModeContextType {
  isEditMode: boolean;
  cancelEdit: (() => void) | null;
  setEditMode: (isEdit: boolean, cancelFn: (() => void) | null) => void;
}

export const EditModeContext = createContext<EditModeContextType>({
  isEditMode: false,
  cancelEdit: null,
  setEditMode: () => {},
});

export const EditModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [cancelEdit, setCancelEdit] = useState<(() => void) | null>(null);

  const setEditMode = (isEdit: boolean, cancelFn: (() => void) | null) => {
    setIsEditMode(isEdit);
    setCancelEdit(() => cancelFn);
  };

  return (
    <EditModeContext.Provider value={{ isEditMode, cancelEdit, setEditMode }}>
      {children}
    </EditModeContext.Provider>
  );
};
