const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth_middleware');
const { createProduct, listProducts, getProduct, updateProduct, deleteProduct } = require('../controllers/products_controller');

router.use(verificarToken);

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: CRUD de productos del usuario autenticado
 */

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Crear un nuevo producto
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - unitPrice
 *               - unitCost
 *               - categoryId
 *               - unitOfMeasureId
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Producto X"
 *               description:
 *                 type: string
 *                 example: "Descripción del producto X"
 *               unitPrice:
 *                 type: number
 *                 example: 100.50
 *               unitCost:
 *                 type: number
 *                 example: 80.00
 *               imageUrl:
 *                 type: string
 *                 example: "http://ejemplo.com/imagen.jpg"
 *               categoryId:
 *                 type: integer
 *                 example: 2
 *               unitOfMeasureId:
 *                 type: integer
 *                 example: 1
 *               quantity:
 *                 type: number
 *                 example: 50
 *               barcode:
 *                 type: string
 *                 example: "1234567890123"
 *     responses:
 *       201:
 *         description: Producto creado exitosamente
 *       400:
 *         description: Error de validación (campos requeridos o numéricos)
 *       409:
 *         description: "Conflicto: nombre o código de barras duplicado"
 *       401:
 *         description: Token inválido o expirado
 */
router.post('/', createProduct);

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Obtener la lista de productos del usuario autenticado
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de productos
 *       401:
 *         description: Token inválido o expirado
 */
router.get('/', listProducts);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Obtener un producto por su ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto
 *     responses:
 *       200:
 *         description: Producto encontrado
 *       404:
 *         description: Producto no encontrado
 *       401:
 *         description: Token inválido o expirado
 */
router.get('/:id', getProduct);

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Actualizar un producto existente
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto a actualizar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Producto X Actualizado"
 *               description:
 *                 type: string
 *                 example: "Nueva descripción"
 *               unitPrice:
 *                 type: number
 *                 example: 110.00
 *               unitCost:
 *                 type: number
 *                 example: 90.00
 *               imageUrl:
 *                 type: string
 *                 example: "http://ejemplo.com/nueva_imagen.jpg"
 *               categoryId:
 *                 type: integer
 *                 example: 2
 *               unitOfMeasureId:
 *                 type: integer
 *                 example: 1
 *               quantity:
 *                 type: number
 *                 example: 60
 *               barcode:
 *                 type: string
 *                 example: "1234567890123"
 *     responses:
 *       200:
 *         description: Producto actualizado exitosamente
 *       400:
 *         description: Error de validación
 *       404:
 *         description: Producto no encontrado
 *       409:
 *         description: "Conflicto: nombre o código de barras duplicado"
 *       401:
 *         description: Token inválido o expirado
 */
router.put('/:id', updateProduct);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Eliminar un producto
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto a eliminar
 *     responses:
 *       200:
 *         description: Producto eliminado exitosamente
 *       404:
 *         description: Producto no encontrado
 *       401:
 *         description: Token inválido o expirado
 */
router.delete('/:id', deleteProduct);

module.exports = router;
