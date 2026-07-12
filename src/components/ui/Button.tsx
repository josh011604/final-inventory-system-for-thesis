import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant
	size?: ButtonSize
}

const variantClass: Record<ButtonVariant, string> = {
	primary:
		'bg-gradient-to-r from-primary to-primary-hover text-white shadow-sm hover:shadow-lg hover:shadow-primary/30 disabled:from-primary/50 disabled:to-primary/50 disabled:shadow-none',
	secondary: 'border border-border bg-surface text-text-primary hover:border-primary hover:text-primary hover:shadow-sm disabled:opacity-50',
	ghost: 'text-text-muted hover:bg-primary-light hover:text-primary disabled:opacity-50',
	danger: 'bg-gradient-to-r from-danger to-danger/80 text-white shadow-sm hover:shadow-lg hover:shadow-danger/30 disabled:opacity-50',
}

const sizeClass: Record<ButtonSize, string> = {
	sm: 'px-3 py-1.5 text-xs',
	md: 'px-4 py-2.5 text-sm',
}

export default function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
	return (
		<button
			type={props.type ?? 'button'}
			className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
			{...props}
		/>
	)
}
