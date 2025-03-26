const pool = require('../config/data_base');

class InventoryTransaction {
  // Transaction types constants (matching IDs in the database)
  static TRANSACTION_TYPES = {
    PURCHASE_ORDER: 1,
    SALES_ORDER: 2,
    SALE_RETURN: 3,
    PURCHASE_RETURN: 4,
    ADJUSTMENT: 5,
    LOSS: 6
  };

  // Record an inventory transaction
  static async recordTransaction(client, {
    userId,
    productId,
    quantity, // Positive for increases, negative for decreases
    transactionTypeId,
    salesOrderProductId = null,
    purchaseOrderProductId = null
  }) {
    // Get the current stock level
    const { rows: productRows } = await client.query(
      `SELECT quantity FROM public.products WHERE id = $1`,
      [productId]
    );
    
    if (!productRows.length) {
      throw new Error(`Product with ID ${productId} not found`);
    }
    
    const previousStock = productRows[0].quantity;
    const newStock = previousStock + quantity;
    
    // Record the transaction
    const { rows } = await client.query(
      `INSERT INTO public.inventory_transactions(
        user_id, product_id, quantity, transaction_type_id,
        sales_order_product_id, purchase_order_product_id,
        previous_stock, new_stock
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        userId,
        productId,
        quantity,
        transactionTypeId,
        salesOrderProductId,
        purchaseOrderProductId,
        previousStock,
        newStock
      ]
    );
    
    return rows[0];
  }

  // Get transaction history for a product
  static async getProductTransactions(productId, userId) {
    const { rows } = await pool.query(
      `SELECT it.*, tt.name as transaction_type_name
       FROM public.inventory_transactions it
       JOIN public.transaction_types tt ON it.transaction_type_id = tt.id
       WHERE it.product_id = $1 AND it.user_id = $2
       ORDER BY it.created_at DESC`,
      [productId, userId]
    );
    return rows;
  }

  // Get all transactions for a user
  static async getUserTransactions(userId, limit = 100, offset = 0) {
    const { rows } = await pool.query(
      `SELECT it.*, tt.name as transaction_type_name, p.name as product_name
       FROM public.inventory_transactions it
       JOIN public.transaction_types tt ON it.transaction_type_id = tt.id
       JOIN public.products p ON it.product_id = p.id
       WHERE it.user_id = $1
       ORDER BY it.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  }
}

module.exports = InventoryTransaction;
