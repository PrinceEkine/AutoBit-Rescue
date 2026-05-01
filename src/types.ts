export type UserRole = 'customer' | 'admin' | 'staff' | 'mechanic';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  isOnline?: boolean;
  lastShiftAction?: string;
  whatsappNumber?: string;
  isPremium?: boolean;
  premiumUntil?: string;
  plan?: 'Basic' | 'Standard' | 'Elite';
  createdAt: string;
}

export interface CarDetails {
  make: string;
  model: string;
  year: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  state?: string;
  country?: string;
}

export type RequestStatus = 'pending' | 'assigned' | 'in-progress' | 'arrived' | 'completed' | 'cancelled';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isAdmin: boolean;
}

export interface SparePart {
  id: string;
  name: string;
  category: 'Engine' | 'Tires' | 'Brakes' | 'Electrical' | 'Body' | 'Other';
  price: number;
  description: string;
  stock: number;
  image: string;
  compatibility?: string;
  createdAt: string;
}

export interface ServiceRequest {
  id?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  carDetails: CarDetails;
  description: string;
  location: LocationData;
  status: RequestStatus;
  isEmergency: boolean;
  mechanicId?: string;
  mechanicName?: string;
  eta?: string;
  estimatedCost?: number;
  paymentStatus?: 'unpaid' | 'paid' | 'pending';
  paymentReference?: string;
  staffNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Mechanic {
  uid: string;
  name: string;
  photoUrl?: string;
  skills: string[];
  availability: 'available' | 'busy' | 'offline';
  phone: string;
  location?: LocationData;
}
