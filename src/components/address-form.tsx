'use client';

import {
  useController,
  Control,
  FieldPath,
  FieldValues,
} from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AddressFormData } from '@/lib/address-validation';
import { US_STATES } from '@/lib/us-states';

interface AddressFormProps<T extends FieldValues> {
  control: Control<T>;
  namePrefix?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function AddressForm<T extends FieldValues>({
  control,
  namePrefix = '',
  required = false,
  disabled = false,
  className = '',
}: AddressFormProps<T>) {
  const getFieldName = (field: keyof AddressFormData): FieldPath<T> => {
    return (namePrefix ? `${namePrefix}.${field}` : field) as FieldPath<T>;
  };

  const { field: streetAddressField, fieldState: streetAddressState } =
    useController({
      name: getFieldName('streetAddress'),
      control,
    });

  const { field: cityField, fieldState: cityState } = useController({
    name: getFieldName('city'),
    control,
  });

  const { field: stateField, fieldState: stateState } = useController({
    name: getFieldName('state'),
    control,
  });

  const { field: zipCodeField, fieldState: zipCodeState } = useController({
    name: getFieldName('zipCode'),
    control,
  });

  return (
    <div className={`space-y-4 ${className}`}>
      <div className='space-y-2'>
        <Label htmlFor={`${namePrefix}-street-address`}>
          Street Address {required && <span className='text-red-500'>*</span>}
        </Label>
        <Input
          id={`${namePrefix}-street-address`}
          placeholder='123 Main Street'
          disabled={disabled}
          {...streetAddressField}
        />
        {streetAddressState.error && (
          <p className='text-sm text-red-500'>
            {streetAddressState.error.message}
          </p>
        )}
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div className='space-y-2 md:col-span-2'>
          <Label htmlFor={`${namePrefix}-city`}>
            City {required && <span className='text-red-500'>*</span>}
          </Label>
          <Input
            id={`${namePrefix}-city`}
            placeholder='New York'
            disabled={disabled}
            {...cityField}
          />
          {cityState.error && (
            <p className='text-sm text-red-500'>{cityState.error.message}</p>
          )}
        </div>

        <div className='space-y-2'>
          <Label htmlFor={`${namePrefix}-state`}>
            State {required && <span className='text-red-500'>*</span>}
          </Label>
          <Select
            disabled={disabled}
            value={stateField.value || ''}
            onValueChange={stateField.onChange}
          >
            <SelectTrigger>
              <SelectValue placeholder='Select state' />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state.code} value={state.code}>
                  {state.name} ({state.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {stateState.error && (
            <p className='text-sm text-red-500'>{stateState.error.message}</p>
          )}
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor={`${namePrefix}-zip-code`}>
          ZIP Code {required && <span className='text-red-500'>*</span>}
        </Label>
        <Input
          id={`${namePrefix}-zip-code`}
          placeholder='12345 or 12345-6789'
          className='max-w-xs'
          disabled={disabled}
          {...zipCodeField}
        />
        {zipCodeState.error && (
          <p className='text-sm text-red-500'>{zipCodeState.error.message}</p>
        )}
      </div>
    </div>
  );
}
