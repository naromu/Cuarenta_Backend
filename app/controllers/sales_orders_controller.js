const SalesOrder = require('../models/sales_orders_model');
const Customer = require('../models/customers_model');
const Product = require('../models/products_model');
const { sendResponse } = require('../utils/response_util');

// Create a sales order with its products
async function createSalesOrder(req, res) {
  try {
    const { customer_id, status_id, notes, items, order_date } = req.body;
    const userId = req.usuario.userId;

    // Validate required fields
    if (!customer_id || !status_id || !items || !Array.isArray(items) || items.length === 0) {
      return sendResponse(res, 400, 'error', 'Cliente, estado y al menos un producto son requeridos');
    }

    // Execute all the validation and creation logic within a transaction
    const salesOrder = await SalesOrder.executeWithTransaction(async (client) => {
      // Validate customer belongs to user
      const customer = await Customer.findById(customer_id, userId);
      if (!customer) {
        throw new Error('Cliente no encontrado o no pertenece al usuario');
      }

      // Validate all products belong to user and have sufficient stock
      // Calculate subtotal while validating products
      let subtotal = 0;
      for (const product of items) {
        if (!product.product_id || !product.quantity || !product.unit_price) {
          throw new Error('Cada producto debe tener ID, cantidad y precio unitario');
        }
        
        const productExists = await Product.findById(product.product_id, userId);
        if (!productExists) {
          throw new Error(`Producto con ID ${product.product_id} no encontrado o no pertenece al usuario`);
        }
        
        // Check if product has sufficient stock
        const hasSufficientStock = await Product.hasSufficientStock(product.product_id, product.quantity, userId);
        if (!hasSufficientStock) {
          throw new Error(`Producto con ID ${product.product_id} no tiene suficiente stock disponible`);
        }

        // Add to subtotal
        subtotal += product.quantity * product.unit_price;
      }

      // Calculate total amount (including tax)
      const totalAmount = subtotal * 1.19; // Assuming 19% tax rate

      // Create the sales order with its products
      const salesOrder = await SalesOrder.create({
        userId,
        customer_id,
        status_id,
        subtotal,
        totalAmount,
        notes,
        items,
        order_date,
        client
      });

      // Update product stock quantities
      for (const product of items) {
        // Subtract quantity (passing negative value to decrease stock)
        await Product.updateStock(product.product_id, -product.quantity, userId, client);
      }

      return salesOrder;
    }).catch(error => {
      throw error;
    });

    return sendResponse(res, 201, 'success', 'Orden de venta creada exitosamente', salesOrder);
  } catch (error) {
    console.error('Error al crear orden de venta:', error);
    return sendResponse(res, 500, 'error', error.message || 'Error interno del servidor');
  }
}

// Get all sales orders for a user
async function listSalesOrders(req, res) {
  try {
    const userId = req.usuario.userId;
    const salesOrders = await SalesOrder.findAllByUser(userId);
    return sendResponse(res, 200, 'success', 'Órdenes de venta obtenidas', salesOrders);
  } catch (error) {
    console.error('Error al listar órdenes de venta:', error);
    return sendResponse(res, 500, 'error', 'Error interno del servidor');
  }
}

// Get a specific sales order with its products
async function getSalesOrder(req, res) {
  try {
    const orderId = req.params.id;
    const userId = req.usuario.userId;

    const salesOrder = await SalesOrder.findById(orderId, userId);
    if (!salesOrder) {
      return sendResponse(res, 404, 'error', 'Orden de venta no encontrada');
    }

    // Get the products for this sales order
    const products = await SalesOrder.getProducts(orderId, userId);
    
    // Combine order and products data
    const result = {
      ...salesOrder,
      products
    };

    return sendResponse(res, 200, 'success', 'Orden de venta encontrada', result);
  } catch (error) {
    console.error('Error al obtener orden de venta:', error);
    return sendResponse(res, 500, 'error', 'Error interno del servidor');
  }
}

// Update a sales order
async function updateSalesOrder(req, res) {
  try {
    const orderId = req.params.id;
    const { customer_id, status_id, order_date, notes, items } = req.body;
    const userId = req.usuario.userId;

    // Validate required fields
    if (!customer_id || !status_id) {
      return sendResponse(res, 400, 'error', 'Cliente y estado son campos requeridos');
    }

    // Execute all validation and update logic within a transaction
    const updated = await SalesOrder.executeWithTransaction(async (client) => {
      // Validate customer belongs to user
      const customer = await Customer.findById(customer_id, userId);
      if (!customer) {
        throw new Error('Cliente no encontrado o no pertenece al usuario');
      }

      // Validate the order exists
      const existingOrder = await SalesOrder.findById(orderId, userId);
      if (!existingOrder) {
        throw new Error('Orden de venta no encontrada');
      }

      // Get existing products for this order to calculate inventory changes
      const existingProducts = await SalesOrder.getProducts(orderId, userId);
      
      // Create a map of existing products for easier comparison
      const existingProductsMap = {};
      existingProducts.forEach(product => {
        existingProductsMap[product.product_id] = {
          quantity: product.quantity,
          product_id: product.product_id
        };
      });

      // Calculate subtotal and totalAmount if items are provided
      let subtotal = existingOrder.subtotal;
      let totalAmount = existingOrder.total_amount;
      
      if (items && Array.isArray(items) && items.length > 0) {
        // Validate all products belong to user
        for (const item of items) {
          if (!item.product_id || !item.quantity || !item.unit_price) {
            throw new Error('Cada producto debe tener ID, cantidad y precio unitario');
          }
          
          const productExists = await Product.findById(item.product_id, userId);
          if (!productExists) {
            throw new Error(`Producto con ID ${item.product_id} no encontrado o no pertenece al usuario`);
          }
          
          // Check inventory for increased quantities
          const existingQty = existingProductsMap[item.product_id] ? existingProductsMap[item.product_id].quantity : 0;
          const qtyDifference = item.quantity - existingQty;
          
          if (qtyDifference > 0) {
            // Need to check if we have enough inventory for the increased amount
            const hasSufficientStock = await Product.hasSufficientStock(item.product_id, qtyDifference, userId);
            if (!hasSufficientStock) {
              throw new Error(`Producto con ID ${item.product_id} no tiene suficiente stock disponible para el incremento solicitado`);
            }
          }
        }

        // Calculate new subtotal from items
        subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        
        // Apply simple tax calculation (19% VAT)
        totalAmount = subtotal * 1.19;
      }

      // Format items for database
      const formattedItems = items ? items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      })) : [];

      // Update the sales order
      const updated = await SalesOrder.update(orderId, {
        customer_id,
        status_id,
        order_date,
        subtotal,
        totalAmount,
        notes,
        items: formattedItems
      }, userId, client);
      
      if (!updated) {
        throw new Error('No se pudo actualizar la orden de venta');
      }
      
      // Process inventory adjustments for each product
      
      // First, handle items that were in the original order but are removed or changed
      for (const product_id in existingProductsMap) {
        const existingQty = existingProductsMap[product_id].quantity;
        const newItem = items ? items.find(item => item.product_id == product_id) : null;
        const newQty = newItem ? newItem.quantity : 0;
        
        // Calculate the difference in quantity (negative means we need to return stock)
        const qtyDifference = newQty - existingQty;
        
        if (qtyDifference !== 0) {
          // Update product stock (negative value decreases stock, positive increases)
          await Product.updateStock(product_id, -qtyDifference, userId, client);
        }
      }
      
      // Now handle any new items that weren't in the original order
      if (items && Array.isArray(items)) {
        for (const item of items) {
          if (!existingProductsMap[item.product_id]) {
            // This is a new product, so decrease its stock by the full quantity
            await Product.updateStock(item.product_id, -item.quantity, userId, client);
          }
        }
      }

      return updated;
    }).catch(error => {
      throw error;
    });

    return sendResponse(res, 200, 'success', 'Orden de venta actualizada', updated);
  } catch (error) {
    console.error('Error al actualizar orden de venta:', error);
    return sendResponse(res, 500, 'error', error.message || 'Error interno del servidor');
  }
}

// Delete a sales order
async function deleteSalesOrder(req, res) {
  try {
    const orderId = req.params.id;
    const userId = req.usuario.userId;

    const deleted = await SalesOrder.delete(orderId, userId);
    if (!deleted) {
      return sendResponse(res, 404, 'error', 'Orden de venta no encontrada');
    }

    return sendResponse(res, 200, 'success', 'Orden de venta eliminada');
  } catch (error) {
    console.error('Error al eliminar orden de venta:', error);
    return sendResponse(res, 500, 'error', 'Error interno del servidor');
  }
}

module.exports = {
  createSalesOrder,
  listSalesOrders,
  getSalesOrder,
  updateSalesOrder,
  deleteSalesOrder
};
