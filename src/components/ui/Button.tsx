import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant
	size?: ButtonSize
}

const variantClass: Record<ButtonVariant, string> = {
	primary: 'bg-primary text-white hover:bg-primary-hover disabled:bg-primary/50',
	secondary: 'border border-border bg-surface text-text-primary hover:border-primary hover:text-primary disabled:opacity-50',
	ghost: 'text-text-muted hover:bg-primary-light hover:text-primary disabled:opacity-50',
	danger: 'bg-danger text-white hover:opacity-90 disabled:opacity-50',
}

const sizeClass: Record<ButtonSize, string> = {
	sm: 'px-3 py-1.5 text-xs',
	md: 'px-4 py-2.5 text-sm',
}

export default function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
	return (
		<button
			type={props.type ?? 'button'}
			className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed ${variantClass[variant]} ${sizeClass[size]} ${className}`}
			{...props}
		/>
	)
}
