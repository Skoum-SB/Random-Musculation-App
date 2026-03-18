import { useState, useEffect, useRef } from 'react';
import { TextInput, type StyleProp, type TextStyle } from 'react-native';

interface DecimalInputProps {
  value: number;
  onChange: (value: string) => void;
  style?: StyleProp<TextStyle>;
  selectTextOnFocus?: boolean;
}

/**
 * TextInput pour les valeurs décimales (poids, distance).
 * Garde un état local pour ne pas effacer la virgule/point en cours de saisie.
 * Se resynchronise depuis le prop `value` seulement si la valeur externe change vraiment.
 */
export function DecimalInput({ value, onChange, style, selectTextOnFocus }: DecimalInputProps) {
  const textRef = useRef(String(value));
  const [text, setText] = useState(String(value));

  useEffect(() => {
    const currentParsed = parseFloat(textRef.current.replace(',', '.'));
    if (currentParsed !== value) {
      const newText = String(value);
      textRef.current = newText;
      setText(newText);
    }
  }, [value]);

  function handleChange(v: string) {
    const normalized = v.replace(',', '.');
    textRef.current = normalized;
    setText(normalized);
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed)) {
      onChange(normalized);
    }
  }

  return (
    <TextInput
      style={style}
      value={text}
      keyboardType="decimal-pad"
      selectTextOnFocus={selectTextOnFocus}
      onChangeText={handleChange}
    />
  );
}
