export type Role = 'super_admin' | 'department_admin' | 'staff'

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

export interface InventoryItem {
	id: string
	assetId: string
	name: string
	category: string
	brand: string
	model: string
	serialNumber: string
	quantity: number
	unit: string
	purchaseDate: string
	supplier: string
	department: string
	facility: string
	room: string
	condition: 'Excellent' | 'Good' | 'Fair' | 'Damaged'
	status: 'Available' | 'Borrowed' | 'Under Maintenance' | 'Damaged' | 'Lost' | 'Disposed'
	remarks: string
}

export interface Facility {
	id: string
	name: string
	type: string
	department: string
	capacity: number
	availability: 'Available' | 'Reserved' | 'In Use' | 'Under Maintenance'
	equipmentCount: number
	maintenanceCount: number
}

export interface BorrowRequest {
	id: string
	department: string
	item: string
	borrower: string
	approver: string
	borrowDate: string
	dueDate: string
	returnDate: string
	status: 'Pending' | 'Approved' | 'Returned' | 'Rejected' | 'Overdue'
	conditionBefore: string
	conditionAfter: string
}

export interface MaintenanceRequest {
	id: string
	department: string
	item: string
	requester: string
	assignee: string
	status: 'Pending' | 'Approved' | 'In Progress' | 'Completed' | 'Rejected'
	requestedAt: string
	updatedAt: string
}

export interface NotificationItem {
	id: string
	title: string
	message: string
	time: string
	tone: 'info' | 'warning' | 'success' | 'danger'
}

export interface ActivityItem {
	id: string
	title: string
	detail: string
	time: string
	tone: 'blue' | 'slate' | 'emerald' | 'amber'
}

export interface LoginLog {
	id: string
	user: string
	role: Role | 'system'
	event: string
	time: string
	ip: string
}

export interface CalendarEvent {
	id: string
	title: string
	date: string
	department: string
	type: 'Maintenance' | 'Reservation' | 'Audit' | 'Training'
}