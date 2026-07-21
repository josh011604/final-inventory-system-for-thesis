export type Role = 'super_admin' | 'department_admin' | 'staff' | 'student'

export type ThemeMode = 'light' | 'dark'

export type UserStatus = 'Active' | 'Inactive'

export interface Department {
	id: string
	name: string
	shortName: string
	color: string
	programs: string[]
}

export interface SchoolUser {
	id: string
	fullName: string
	employeeId: string | null
	departmentId: string | null
	department: string
	position: string | null
	email: string
	username: string
	role: Role
	status: UserStatus
	profilePicture: string
}