// /var/www/movethatstuff/backend/routes/estimateRoutes.js
const express = require('express');
const { authenticateToken, requirePermission, validate } = require('../middleware');
const estimateController = require('../controllers/estimateController');

const router = express.Router();

router.get('/', authenticateToken, requirePermission('view_estimates'), estimateController.getAllEstimates);

router.get('/:id', authenticateToken, requirePermission('view_estimates'), estimateController.getEstimateById);

router.post('/', authenticateToken, requirePermission('edit_estimates'), validate(estimateController.estimateSchema), estimateController.createEstimate);

router.put('/:id', authenticateToken, requirePermission('edit_estimates'), validate(estimateController.partialEstimateSchema), estimateController.updateEstimate);

router.delete('/:id', authenticateToken, requirePermission('edit_estimates'), estimateController.deleteEstimate);

router.post('/:id/calculate', authenticateToken, requirePermission('edit_estimates'), estimateController.calculate);

router.post('/:id/reorder-stops', authenticateToken, requirePermission('edit_estimates'), validate(estimateController.reorderSchema), estimateController.reorderStops);

router.post('/:id/stops', authenticateToken, requirePermission('edit_estimates'), validate(estimateController.stopSchema), estimateController.addStop);

router.delete('/:id/stops/:stopId', authenticateToken, requirePermission('edit_estimates'), estimateController.deleteStop);

router.put('/:id/stops/:stopId', authenticateToken, requirePermission('edit_estimates'), validate(estimateController.stopSchema), estimateController.updateStop);

router.get('/:id/line-items', authenticateToken, requirePermission('view_estimates'), estimateController.getLineItems);

router.post('/:id/line-items', authenticateToken, requirePermission('edit_estimates'), validate(estimateController.lineItemSchema), estimateController.addLineItem);

router.put('/:id/line-items/:lineId', authenticateToken, requirePermission('edit_estimates'), validate(estimateController.lineItemSchema), estimateController.updateLineItem);

router.delete('/:id/line-items/:lineId', authenticateToken, requirePermission('edit_estimates'), estimateController.deleteLineItem);

module.exports = router;