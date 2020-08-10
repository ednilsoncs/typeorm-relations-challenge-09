import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import { IProduct as IProductCreateOrder } from '@modules/orders/dtos/ICreateOrderDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Invalid customer_id');
    }

    const productsOnDb = await this.productsRepository.findAllById(products);

    // check quantities
    const productsToRegister: IProductCreateOrder[] = [];
    products.forEach(product => {
      const quantityOrdered = product.quantity;
      const productOnDb = productsOnDb.find(el => el.id === product.id);

      if (!productOnDb) {
        throw new AppError('Invalid productId');
      }

      if (productOnDb.quantity < quantityOrdered) {
        throw new AppError('Quantity of some products not available');
      }

      productsToRegister.push({
        product_id: product.id,
        quantity: product.quantity,
        price: productOnDb.price,
      });

      productOnDb.quantity -= quantityOrdered;
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productsToRegister,
    });

    await this.productsRepository.updateQuantity(productsOnDb);

    return order;
  }
}

export default CreateOrderService;
