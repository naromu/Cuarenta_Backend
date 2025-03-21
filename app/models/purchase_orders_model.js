const pool = require('../config/data_base');

class PurchaseOrder {
    static async addProducts(client, orderId, products, userId) {
        for (const { product_id, quantity, unit_price } of products) {
          await client.query(
            `INSERT INTO public.purchase_order_products(purchase_order_id, product_id, quantity, unit_price)
             VALUES ($1, $2, $3, $4)`,
            [orderId, product_id, quantity, unit_price]
          );
      
          const result = await client.query(
            `UPDATE public.products
               SET quantity = quantity + $1
             WHERE id = $2 AND user_id = $3
             RETURNING unit_price`,
            [quantity, product_id, userId]
          );
      
          if (!result.rows.length) {
            throw new Error(`No se pudo actualizar inventario para producto ${product_id}`);
          }
      
          const currentUnitPrice = result.rows[0].unit_price;
      
          // Verificar si esta orden es la más reciente
          const { rows: [latest] } = await client.query(
            `SELECT po.id
             FROM public.purchase_orders po
             JOIN public.purchase_order_products pop ON pop.purchase_order_id = po.id
             WHERE pop.product_id = $1 AND po.user_id = $2
             ORDER BY po.purchase_order_date DESC
             LIMIT 1`,
            [product_id, userId]
          );
      
          if (latest?.id === orderId && unit_price > currentUnitPrice) {
            await client.query(
              `UPDATE public.products
               SET unit_price = $1
               WHERE id = $2 AND user_id = $3`,
              [unit_price, product_id, userId]
            );
          }
        }
      }
      
    
    static async createOrder(client, { userId, supplier_id, status_id, subtotal, total_amount, purchase_order_date, notes }) {
        const { rows } = await client.query(
          `INSERT INTO public.purchase_orders(user_id, supplier_id, status_id, subtotal, total_amount, purchase_order_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [userId, supplier_id, status_id, subtotal, total_amount, purchase_order_date, notes]
        );
        return rows[0];
      }
      
    
  static async create({ supplier_id, status_id = null, purchase_order_date = null, notes = null, products, userId }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO public.purchase_orders(user_id, supplier_id, status_id, purchase_order_date, notes)
         VALUES($1,$2,$3,COALESCE($4,NOW()),$5) RETURNING *`,
        [userId, supplier_id, status_id, purchase_order_date, notes]
      );
      const order = rows[0];

      const insertItem = `INSERT INTO public.purchase_order_products(purchase_order_id, product_id, quantity, unit_price)
                          VALUES($1,$2,$3,$4) RETURNING *`;
      const items = [];
      for (const p of products) {
        const { rows: itemRows } = await client.query(insertItem, [
          order.id, p.product_id, p.quantity, p.unit_price
        ]);
        items.push(itemRows[0]);
      }

      await client.query('COMMIT');
      return { order, items };
    } catch(err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async findAllByUser(userId) {
    const { rows } = await pool.query(
      `SELECT po.*, json_agg(pop.*) AS items
       FROM public.purchase_orders po
       LEFT JOIN public.purchase_order_products pop ON pop.purchase_order_id = po.id
       WHERE po.user_id = $1
       GROUP BY po.id ORDER BY po.created_at DESC`,
      [userId]
    );
    return rows;
  }

  static async findById(id, userId) {
    const { rows } = await pool.query(
      `SELECT po.*, json_agg(pop.*) AS items
       FROM public.purchase_orders po
       LEFT JOIN public.purchase_order_products pop ON pop.purchase_order_id = po.id
       WHERE po.id = $1 AND po.user_id = $2
       GROUP BY po.id`,
      [id, userId]
    );
    return rows[0];
  }

  static async delete(id, userId) {
    const { rows } = await pool.query(
      `DELETE FROM public.purchase_orders WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );
    return rows[0];
  }

  static async update({ id, supplier_id, status_id = null, purchase_order_date = null, notes = null, products, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener items actuales
    const { rows: existingItems } = await client.query(
      `SELECT product_id, quantity FROM public.purchase_order_products WHERE purchase_order_id = $1`,
      [id]
    );

    // Revertir stock de productos antiguos
    for (const item of existingItems) {
      await client.query(
        `UPDATE public.products SET quantity = quantity - $1 WHERE id = $2 AND user_id = $3`,
        [item.quantity, item.product_id, userId]
      );
    }

    // Eliminar items anteriores
    await client.query(
      `DELETE FROM public.purchase_order_products WHERE purchase_order_id = $1`,
      [id]
    );

    // Actualizar cabecera de orden
    const { rows } = await client.query(
      `UPDATE public.purchase_orders
         SET supplier_id=$1, status_id=$2, purchase_order_date=COALESCE($3,NOW()), notes=$4, updated_at=NOW()
       WHERE id=$5 AND user_id=$6 RETURNING *`,
      [supplier_id, status_id, purchase_order_date, notes, id, userId]
    );
    const order = rows[0];

    // Insertar nuevos items y actualizar stock
    const items = [];
    for (const p of products) {
      const { rows: itemRows } = await client.query(
        `INSERT INTO public.purchase_order_products(purchase_order_id, product_id, quantity, unit_price)
         VALUES($1,$2,$3,$4) RETURNING *`,
        [order.id, p.product_id, p.quantity, p.unit_price]
      );
      items.push(itemRows[0]);

      await client.query(
        `UPDATE public.products SET quantity = quantity + $1 WHERE id = $2 AND user_id = $3`,
        [p.quantity, p.product_id, userId]
      );
    }

    await client.query('COMMIT');
    return { order, items };
  } catch(err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

}



module.exports = PurchaseOrder;
