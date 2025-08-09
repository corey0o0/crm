# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend Development
- **Start development server**: `npm start` (uses --openssl-legacy-provider for compatibility)
- **Build for production**: `npm run build` (includes custom env variable injection)
- **Run tests**: `npm test`

### Backend Development
- **Start Express server**: `cd server && node index.js` (port 5000)
- **Server features**: OCR processing, AI receipt analysis, file uploads

### No linting or type checking scripts configured - verify manually before commits

## Application Architecture

### Technology Stack
- **Frontend**: React 18.2.0 with Create React App + Material-UI 5.15.6
- **Backend**: Express.js server for file processing and AI integration  
- **Database**: Supabase (PostgreSQL) with real-time subscriptions
- **Deployment**: Netlify with SPA routing configuration

### Core Business Functions
This is a Korean CRM system focused on after-service (A/S) management with these main modules:
1. **Service Management**: Complete A/S workflow and customer service tracking
2. **Customer Management**: Customer database with service history
3. **Shipment Management**: Product delivery and parts tracking with inventory
4. **Receipt Processing**: AI-powered OCR using Tesseract.js + Anthropic Claude
5. **Dashboard**: Real-time statistics with user memos and Telegram notifications

### Component Organization
```
src/components/
├── Auth/           # Authentication (Login, ProtectedRoute)
├── Customer/       # Customer management and search
├── Service/        # A/S management (AddService split into 5 components)
├── Product/        # Shipment and inventory management  
├── Receipt/        # AI-powered receipt scanning
├── Dashboard/      # Main dashboard with memos and statistics
└── common/         # Shared components (ResponsiveTable)
```

### Key Files and Patterns
- **Database config**: `/src/lib/supabaseClient.js` - Supabase client with session management
- **Theme**: `/src/theme.js` - Custom Material-UI theme with Korean fonts (Pretendard)
- **API layer**: `/src/api/services.js` - Centralized service calls
- **Authentication**: `/src/contexts/AuthContext.js` - Auth state management
- **Server**: `/server/index.js` - Express server with OCR and AI processing

### Database Structure
Key tables in Supabase:
- `services` - A/S service records
- `customers` - Customer information  
- `shipments` - Product shipment tracking
- `shipment_parts` - Parts inventory with foreign keys
- `user_memos` - User notes (memo1, memo2, memo3 fields)

All tables have Row Level Security enabled with user-based policies.

### Development Notes
- **Korean Business Context**: All interfaces, data, and business logic are Korean-localized
- **Real-time Updates**: Dashboard and notifications use Supabase real-time subscriptions  
- **File Processing Pipeline**: OCR (Tesseract) → AI Analysis (Claude) → Structured data extraction
- **Mobile-Responsive**: Material-UI with drawer navigation pattern
- **Environment Variables**: Dynamic loading via `scripts/generate-env.js` in build process
- **Component Separation**: Large components like AddService.jsx have been split into smaller, focused components

### External Integrations
- **Google Drive**: File storage and sharing
- **Telegram**: Notification system for memos and alerts
- **Anthropic Claude**: AI-powered receipt analysis and data extraction
- **Cloudmersive**: Document conversion services