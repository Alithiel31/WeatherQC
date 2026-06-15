export const config = {
  port: parseInt(process.env.PORT || '3005'),
  isProd: process.env.NODE_ENV === 'production',
};
