'use client';

import { useRef, useEffect } from 'react';
import {
  useController,
  Control,
  FieldPath,
  FieldValues,
} from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EINInputProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  nextInputId?: string; // ID of the next input to focus after completing EIN
}

export function EINInput<T extends FieldValues>({
  control,
  name,
  label = 'EIN (Employer Identification Number)',
  required = false,
  disabled = false,
  className = '',
  id,
  nextInputId,
}: EINInputProps<T>) {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const secondInputRef = useRef<HTMLInputElement>(null);

  const { field, fieldState } = useController({
    name,
    control,
  });

  // Parse the EIN value into two parts
  const parseEIN = (value: string): { first: string; second: string } => {
    if (!value) return { first: '', second: '' };

    // Remove any non-digits and hyphens
    const cleaned = value.replace(/[^\d-]/g, '');

    if (cleaned.includes('-')) {
      const parts = cleaned.split('-');
      return {
        first: parts[0]?.substring(0, 2) || '',
        second: parts[1]?.substring(0, 7) || '',
      };
    }

    // If no hyphen, assume it's all digits
    const digits = cleaned.replace(/-/g, '');
    return {
      first: digits.substring(0, 2),
      second: digits.substring(2, 9),
    };
  };

  const { first, second } = parseEIN(field.value || '');

  const handleFirstChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.substring(0, 2);
    const newEIN = value + (second ? `-${second}` : '');
    field.onChange(newEIN);

    // Auto-focus to second input when first input has 2 digits and they're all numbers
    if (value.length === 2 && /^\d{2}$/.test(value) && secondInputRef.current) {
      secondInputRef.current.focus();
    }
  };

  const handleSecondChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.substring(0, 7);
    const newEIN = first + (value ? `-${value}` : '');
    field.onChange(newEIN);

    // Auto-focus to next input when second input has 7 digits and they're all numbers
    if (value.length === 7 && /^\d{7}$/.test(value) && nextInputId) {
      const nextInput = document.getElementById(nextInputId);
      if (nextInput && nextInput instanceof HTMLInputElement) {
        nextInput.focus();
      }
    }
  };

  const handleFirstKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to second input on right arrow or tab
    if (
      (e.key === 'ArrowRight' || e.key === 'Tab') &&
      first.length === 2 &&
      secondInputRef.current
    ) {
      e.preventDefault();
      secondInputRef.current.focus();
    }
  };

  const handleSecondKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move back to first input on left arrow when at beginning
    if (
      e.key === 'ArrowLeft' &&
      e.currentTarget.selectionStart === 0 &&
      firstInputRef.current
    ) {
      e.preventDefault();
      firstInputRef.current.focus();
      firstInputRef.current.setSelectionRange(2, 2);
    }
    // Move back to first input on backspace when second field is empty
    if (e.key === 'Backspace' && !second && firstInputRef.current) {
      e.preventDefault();
      firstInputRef.current.focus();
      firstInputRef.current.setSelectionRange(2, 2);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id || `${name}-first`}>
        {label} {required && <span className='text-red-500'>*</span>}
      </Label>
      <div className='flex items-center gap-2'>
        <Input
          ref={firstInputRef}
          id={id || `${name}-first`}
          placeholder='12'
          maxLength={2}
          value={first}
          onChange={handleFirstChange}
          onKeyDown={handleFirstKeyDown}
          disabled={disabled}
          className='w-16 text-center'
        />
        <span className='text-muted-foreground'>-</span>
        <Input
          ref={secondInputRef}
          id={`${id || name}-second`}
          placeholder='3456789'
          maxLength={7}
          value={second}
          onChange={handleSecondChange}
          onKeyDown={handleSecondKeyDown}
          disabled={disabled}
          className='w-24 text-center'
        />
      </div>
      {fieldState.error && (
        <p className='text-sm text-red-500'>{fieldState.error.message}</p>
      )}
      <p className='text-xs text-muted-foreground'>
        Format: XX-XXXXXXX (e.g., 12-3456789)
      </p>
    </div>
  );
}

// Simple EIN component for use with regular state management (non-react-hook-form)
interface SimpleEINProps {
  value: string;
  onValueChangeAction: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  error?: string;
  onValidationChange?: (isValid: boolean) => void;
  nextInputId?: string; // ID of the next input to focus after completing EIN
}

export function SimpleEIN({
  value,
  onValueChangeAction,
  label = 'EIN',
  required = false,
  disabled = false,
  className = '',
  id,
  error,
  onValidationChange,
  nextInputId,
}: SimpleEINProps) {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const secondInputRef = useRef<HTMLInputElement>(null);

  // Parse the EIN value into two parts
  const parseEIN = (value: string): { first: string; second: string } => {
    if (!value) return { first: '', second: '' };

    // Remove any non-digits and hyphens
    const cleaned = value.replace(/[^\d-]/g, '');

    if (cleaned.includes('-')) {
      const parts = cleaned.split('-');
      return {
        first: parts[0]?.substring(0, 2) || '',
        second: parts[1]?.substring(0, 7) || '',
      };
    }

    // If no hyphen, assume it's all digits
    const digits = cleaned.replace(/-/g, '');
    return {
      first: digits.substring(0, 2),
      second: digits.substring(2, 9),
    };
  };

  const { first, second } = parseEIN(value || '');

  // Validate the current EIN value
  const validateEIN = (
    firstPart: string,
    secondPart: string
  ): string | null => {
    if (!firstPart && !secondPart) {
      return required ? 'EIN is required' : null;
    }

    if (firstPart && !/^\d{0,2}$/.test(firstPart)) {
      return 'First part must contain only numbers (2 digits)';
    }

    if (secondPart && !/^\d{0,7}$/.test(secondPart)) {
      return 'Second part must contain only numbers (7 digits)';
    }

    if (firstPart && firstPart.length > 0 && firstPart.length < 2) {
      return 'First part must be exactly 2 digits';
    }

    if (secondPart && secondPart.length > 0 && secondPart.length < 7) {
      return 'Second part must be exactly 7 digits';
    }

    if (
      firstPart &&
      secondPart &&
      (firstPart.length !== 2 || secondPart.length !== 7)
    ) {
      return 'EIN must be in format XX-XXXXXXX (e.g., 12-3456789)';
    }

    return null;
  };

  const currentError = error || validateEIN(first, second);

  // Notify parent of validation state
  useEffect(() => {
    if (onValidationChange) {
      const isValid = !currentError;
      onValidationChange(isValid);
    }
  }, [currentError, onValidationChange]);

  const handleFirstChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.substring(0, 2);
    const newEIN = newValue + (second ? `-${second}` : '');
    onValueChangeAction(newEIN);

    // Auto-focus to second input when first input has 2 digits and they're all numbers
    if (
      newValue.length === 2 &&
      /^\d{2}$/.test(newValue) &&
      secondInputRef.current
    ) {
      secondInputRef.current.focus();
    }
  };

  const handleSecondChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.substring(0, 7);
    const newEIN = first + (newValue ? `-${newValue}` : '');
    onValueChangeAction(newEIN);

    // Auto-focus to next input when second input has 7 digits and they're all numbers
    if (newValue.length === 7 && /^\d{7}$/.test(newValue) && nextInputId) {
      const nextInput = document.getElementById(nextInputId);
      if (nextInput && nextInput instanceof HTMLInputElement) {
        nextInput.focus();
      }
    }
  };

  const handleFirstKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to second input on right arrow or tab
    if (
      (e.key === 'ArrowRight' || e.key === 'Tab') &&
      first.length === 2 &&
      secondInputRef.current
    ) {
      e.preventDefault();
      secondInputRef.current.focus();
    }
  };

  const handleSecondKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move back to first input on left arrow when at beginning
    if (
      e.key === 'ArrowLeft' &&
      e.currentTarget.selectionStart === 0 &&
      firstInputRef.current
    ) {
      e.preventDefault();
      firstInputRef.current.focus();
      firstInputRef.current.setSelectionRange(2, 2);
    }
    // Move back to first input on backspace when second field is empty
    if (e.key === 'Backspace' && !second && firstInputRef.current) {
      e.preventDefault();
      firstInputRef.current.focus();
      firstInputRef.current.setSelectionRange(2, 2);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id || 'ein-first'}>
        {label} {required && <span className='text-red-500'>*</span>}
      </Label>
      <div className='flex items-center gap-2'>
        <Input
          ref={firstInputRef}
          id={id || 'ein-first'}
          placeholder='12'
          maxLength={2}
          value={first}
          onChange={handleFirstChange}
          onKeyDown={handleFirstKeyDown}
          disabled={disabled}
          className={`w-16 text-center ${currentError ? 'border-red-500' : ''}`}
        />
        <span className='text-muted-foreground'>-</span>
        <Input
          ref={secondInputRef}
          id={`${id || 'ein'}-second`}
          placeholder='3456789'
          maxLength={7}
          value={second}
          onChange={handleSecondChange}
          onKeyDown={handleSecondKeyDown}
          disabled={disabled}
          className={`w-24 text-center ${currentError ? 'border-red-500' : ''}`}
        />
      </div>
      {currentError && <p className='text-sm text-red-500'>{currentError}</p>}
      {!currentError && (
        <p className='text-xs text-muted-foreground'>
          Format: XX-XXXXXXX (e.g., 12-3456789)
        </p>
      )}
    </div>
  );
}
