# CafeHunt

CafeHunt is a cafe discovery and reservation web application for customers, shop owners, and administrators. Customers can explore cafes, make reservations, manage profiles, and complete reservation payments. Shop owners can register cafes, manage cafe details, review bookings, and receive notifications. Administrators can review cafe registrations, manage cafe content, and monitor system activity.

## Overview and Website Link

Live website: https://cafehunt.vercel.app/index.html

CafeHunt helps users find cafes, view cafe information, create reservations, and complete payments online. The system also includes role-based workflows so shop owners can manage their cafe presence and admins can approve or reject cafe registration requests.

## Features

### Customer

- Register and log in as a customer.
- Verify email before accessing protected pages.
- Browse cafe listings and gallery content.
- View cafe details, facilities, and posts.
- Create and manage reservations.
- Pay for accepted reservations through ToyyibPay.
- View payment success or failure pages.
- Receive reservation and payment notifications.
- Manage customer profile, email, password, and account settings.

### Shop Owner

- Register and log in as a shop owner.
- Submit cafe registration details for admin approval.
- Access dashboard after cafe approval.
- Manage shop profile, cafe information, operating hours, description, and images.
- View and respond to reservation requests.
- Receive booking and admin notifications.
- Resubmit cafe registration after rejection.

### Admin

- Log in using approved admin accounts.
- Review pending cafe registration requests.
- Approve or reject shop owner cafe submissions.
- Provide rejection notes for shop owners.
- Manage cafe listings and cafe facilities.
- View admin notifications, including payment-related updates.
- Moderate and manage public cafe/post content.

## Technology Stack

### Frontend

- HTML5
- CSS3
- JavaScript ES modules
- Firebase client SDK
- GSAP animations
- Remix Icon / Font Awesome icons

### Backend

- JavaScript
- Vercel 
- Firebase 
- ToyyibPay 

### Authentication & Security

- Firebase Authentication for customer and shop owner accounts
- Email verification before login access
- Password reset through Firebase Authentication
- Role-based page protection 
- Admin access controlled by approved admin email list
- Re-authentication required before sensitive profile changes

## Deployment

The project is deployed on Vercel:

- Production site: https://cafehunt.vercel.app/index.html
- Frontend pages are served as static HTML, CSS, and JavaScript files.
- Backend payment routes are deployed as Vercel serverless functions.
- Firebase provides authentication, database, and file storage services.

Required deployment configuration:

1. Add Firebase project configuration in `assets/js/firebase-config.js`.
2. Add Vercel environment variables for ToyyibPay and Firebase Admin credentials.
3. Deploy the repository to Vercel.
4. Confirm that payment return and callback URLs point to the deployed domain.

## Project Structure

```text
.
├── api/
│   ├── create-bill.js             # Creates ToyyibPay bills
│   └── payment-callback.js        # Handles ToyyibPay payment callbacks
├── assets/
│   ├── css/                       # Page stylesheets
│   ├── img/                       # Static image assets
│   └── js/                        # Firebase, auth, page, and session scripts
├── picture/                       # User, post, and UI images
├── adminapprove.html              # Admin cafe approval page
├── adminnotification.html         # Admin notifications
├── adminpost.html                 # Admin post/content page
├── bookingform.html               # Customer booking form
├── customernotification.html      # Customer notifications
├── gallery.html                   # Cafe listing/gallery page
├── index.html                     # Login and registration landing page
├── paymentpage.html               # Payment checkout page
├── paymentresult.html             # Payment result redirect page
├── profilepage.html               # Customer profile page
├── profilesopage.html             # Shop owner profile page
├── registercafe.html              # Cafe registration page
├── reservation.html               # Customer reservations page
├── socialpage.html                # Customer social/feed page
├── so_dashboard.html              # Shop owner dashboard
└── README.md
```

## User Roles

| Role | Main Access | Description |
| --- | --- | --- |
| Customer | Gallery, social page, booking, reservations, payment, customer profile, notifications | Finds cafes, makes reservations, pays for bookings, and manages personal account details. |
| Shop Owner | Cafe registration, dashboard, shop owner profile, reservation management, notifications | Registers and manages cafe information after admin approval. |
| Admin | Admin posts, cafe approval, admin notifications, listing management | Reviews cafe registration requests, manages content, and monitors platform activity. |

## Authors

- SV Group 14
- Project contributors:
  - megatarifidlan@graduate.utm.my
  - leexuanhui@graduate.utm.my
  - looeeying@graduate.utm.my
  - ammar06@graduate.utm.my

## License

This project is for academic use. No open-source license has been specified.
