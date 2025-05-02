const router = require('express').Router();
const userController = require('../controllers/userController');
const { ValidateToken } = require('../middleware/auth');

router.post('/sign-up',userController.signUp);
router.post('/login',userController.login);
router.get('/all-user', userController.getAllUsers);
// router.get('/get-staff/:id', ValidateToken, StaffController.getStaff);
// router.put('/update-staff/:id', ValidateToken, StaffController.updateStaff);
// router.delete('/delete-staff/:id', ValidateToken, StaffController.deleteStaff);

module.exports = router