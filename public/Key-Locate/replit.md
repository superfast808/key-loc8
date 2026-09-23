# keylocate Platform - Integrated Operations Suite

## Overview
keylocate is a comprehensive, industry-agnostic operations platform centered around key management, offering a suite of integrated modules. It serves various sectors like real estate, automotive, and security, providing solutions for key tracking, lone worker safety, uniform and equipment management, assignment instructions, and policy distribution. The platform is designed for modularity, allowing companies to subscribe to specific functionalities while sharing a unified data layer, with permissions managed by a central Platform Admin.

The project aims to be a leading integrated operations suite, enhancing efficiency and compliance across diverse industries through its robust, scalable, and secure platform.

## User Preferences
Preferred communication style: Simple, everyday language.
System requirements: Allow same key bunch identifiers (e.g., A24-001) to exist at multiple locations simultaneously.

## System Architecture
The system employs a full-stack architecture utilizing React for the frontend, Express.js for the backend, and PostgreSQL for the database. Multi-tenancy is a core design principle, ensuring strict data isolation between companies.

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query)
- **UI**: Radix UI components styled with Tailwind CSS, emphasizing responsive design.
- **Form Handling**: React Hook Form with Zod validation.
- **Progressive Web App (PWA)**: Supports offline functionality with a service worker caching assets and API responses. Includes features like background sync, offline indicators, and install prompts.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API
- **Authentication**: Session-based with role-based access control and location-specific permissions.
- **Security**: Robust multi-tenant architecture with stringent data isolation at both the storage and API layers to prevent cross-company data access. All operations are scoped to the user's `companyId` and logged for auditability.

### Database
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM with TypeScript schema definitions and Drizzle Kit for migrations.
- **Connection**: Neon Database serverless PostgreSQL.

### Key Features
- **Key Bunch & Location Management**: Comprehensive CRUD operations for keys and locations, including detailed tracking, filtering, and history.
- **Audit System**: Real-time auditing with NFC scanning capabilities, tracking discrepancies, and automated updates.
- **Movement History**: Detailed audit trail of all key movements and modifications.
- **Deleted Keys Viewing**: Functionality to view soft-deleted keys with preserved audit history.
- **Bulk Upload**: Robust CSV bulk upload with multi-encoding support, normalization, and duplicate validation.
- **Customizable Settings**: Administrators can customize key and location types.
- **User Management**: Role-based permissions and profile management.
- **Mobile Responsiveness**: Optimized UI/UX for mobile devices.
- **Notifications**: Mobile-responsive alert system.
- **NFC Tag Validation**: Centralized enforcement of unique NFC tags across the platform.
- **Modules**:
    - **keylocate**: Core key management.
    - **Lone Working**: Worker safety features, including check-ins and GPS tracking.
    - **Uniform & Equipment**: Stock control and assignment for company assets.
    - **Assignment Instructions Builder**: Template-based content creation and management for key-bunch-specific instructions, with customer portal access.
    - **Policies**: Secure distribution and management of company policy documents.
- **Type Matching System**: A critical helper system ensuring consistent type filtering and matching across customized company settings by normalizing type values (ID, name, display name) to a canonical ID, preventing mismatches and ensuring data integrity.
- **Help & Documentation**: Includes a comprehensive employee guide and an AI-powered chat assistant for real-time support.

## External Dependencies

- **@neondatabase/serverless**: Serverless PostgreSQL connection.
- **drizzle-orm** & **drizzle-kit**: ORM and migrations.
- **@tanstack/react-query**: Server state management.
- **@hookform/resolvers**: Form validation integration.
- **wouter**: Client-side routing.
- **zod**: Runtime type validation.
- **@radix-ui/* components**: UI primitives.
- **tailwindcss**: CSS framework.
- **class-variance-authority**: Component variant management.
- **lucide-react**: Icon library.
- **vite**: Build tool.
- **typescript**: Language.
- **tsx**: TypeScript execution.